import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * Client-side session plumbing: one refresh at a time, and a 401 retry that uses it.
 *
 * The backend rotates refresh tokens and treats a replayed one as theft — it
 * revokes *every* session that user has. A page firing five requests at once that
 * all come back 401 would, without a lock, kick off five rotations, four of which
 * present an already-consumed token and log the dispatcher out of everything. So
 * the lock is load-bearing, not an optimisation.
 *
 * Scope note: this lock is per browsing context. Two open tabs can still race each
 * other into a double rotation. Fixing that needs cross-tab coordination (a
 * BroadcastChannel or Web Lock); it is deliberately out of scope here and would
 * only ever be reachable when both tabs' access tokens expire in the same instant.
 */

export type RefreshFetcher = () => Promise<boolean>;

let inFlight: Promise<boolean> | null = null;

export async function defaultRefreshFetcher(): Promise<boolean> {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
  });
  return res.ok;
}

/**
 * Refreshes the session, collapsing concurrent callers onto a single request.
 * Resolves `true` when the cookies were rotated, `false` when the session is gone.
 */
export function refreshSession(fetcher: RefreshFetcher = defaultRefreshFetcher): Promise<boolean> {
  if (!inFlight) {
    inFlight = Promise.resolve()
      .then(fetcher)
      .catch(() => false)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Test seam — drops any lock left over from a previous case. */
export function resetRefreshState(): void {
  inFlight = null;
}

export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  const next = window.location.pathname + window.location.search;
  window.location.href = `/login?next=${encodeURIComponent(next)}`;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean };

/** Requests that must never trigger a refresh — they *are* the auth flow. */
function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('/auth/send-otp') || url.includes('/auth/verify-otp');
}

export interface AuthInterceptorOptions {
  fetcher?: RefreshFetcher;
  onSessionLost?: () => void;
}

export function attachAuthInterceptor(
  client: AxiosInstance,
  { fetcher, onSessionLost = redirectToLogin }: AuthInterceptorOptions = {}
): void {
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetriableConfig | undefined;

      if (
        error.response?.status !== 401 ||
        !config ||
        config._retriedAfterRefresh ||
        isAuthEndpoint(config.url)
      ) {
        return Promise.reject(error);
      }

      // Marked before awaiting: if the retry itself 401s we must give up rather
      // than loop, and the flag has to survive into that second response.
      config._retriedAfterRefresh = true;

      const refreshed = await refreshSession(fetcher);
      if (!refreshed) {
        onSessionLost();
        return Promise.reject(error);
      }

      return client(config);
    }
  );
}
