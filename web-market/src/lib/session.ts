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
 * The same race exists *between* tabs, and the dispatcher panel is an app people
 * keep open in three or four of them. So the in-tab lock is wrapped in a Web Lock
 * (`navigator.locks`), which is scoped to the origin rather than to one document.
 * See `withCrossTabLock` below for the degradation and timeout rules.
 *
 * What the cross-tab lock is *not* for: handing the result from one tab to another.
 * The rotated tokens land in `httpOnly` cookies written by our own /api/auth/refresh
 * response, so every tab on the origin picks them up from the browser without being
 * told. The lock only has to stop two rotations happening at once.
 */

export type RefreshFetcher = () => Promise<boolean>;

/**
 * Origin-scoped, so panels served from different hosts/ports never contend with
 * each other even though they all ship this file.
 */
const REFRESH_LOCK_NAME = 'angren-session-refresh';

/**
 * How long the lock holder may keep it. A refresh that hangs (a stalled fetch, a
 * suspended tab) would otherwise pin the lock for as long as the tab lives and
 * every other tab would sit behind it.
 */
const LOCK_HOLD_TIMEOUT_MS = 10_000;

/**
 * How long a waiter queues before giving up. Deliberately longer than the hold
 * bound: under normal operation the holder always releases first, so reaching this
 * means the Web Locks queue itself is not moving.
 */
const LOCK_WAIT_TIMEOUT_MS = 15_000;

let inFlight: Promise<boolean> | null = null;

export async function defaultRefreshFetcher(): Promise<boolean> {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
  });
  return res.ok;
}

/**
 * Minimal shape of the bits of the Web Locks API we use. Typed here rather than
 * relying on lib.dom, whose `LockManager` is not present in every TS lib target
 * this monorepo builds against.
 */
interface LockManagerLike {
  request(
    name: string,
    options: { signal?: AbortSignal },
    callback: () => Promise<boolean>
  ): Promise<boolean>;
}

/** `null` whenever Web Locks are unusable — old browser, or a non-secure context. */
function getLockManager(): LockManagerLike | null {
  if (typeof navigator === 'undefined') return null;
  const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks;
  return locks && typeof locks.request === 'function' ? locks : null;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'AbortError'
  );
}

/**
 * Runs `fetcher`, but never for longer than `LOCK_HOLD_TIMEOUT_MS`.
 *
 * On timeout the refresh is reported as failed and the lock is released; the
 * abandoned request may still complete in the background, which is harmless —
 * it either rotates the cookies (and the next 401 succeeds) or it does not.
 */
function runBounded(fetcher: RefreshFetcher): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expiry = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), LOCK_HOLD_TIMEOUT_MS);
  });

  return Promise.race([
    Promise.resolve()
      .then(fetcher)
      .catch(() => false),
    expiry,
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Serialises `run` across every tab on this origin.
 *
 * Two escape hatches, both deliberate:
 *
 *  - **No Web Locks** (older Safari/Firefox, or an insecure context): fall through
 *    and run under the in-tab lock alone. That is exactly the behaviour this file
 *    had before, so an unsupported browser is no worse off than it was.
 *  - **Waited too long**: a browser crash or a closed tab releases a Web Lock
 *    automatically, and a live holder is already bounded to `LOCK_HOLD_TIMEOUT_MS`,
 *    so a waiter that reaches `LOCK_WAIT_TIMEOUT_MS` is queued behind something the
 *    browser is never going to release. Refusing to refresh at that point would
 *    strand the tab permanently, so we proceed unlocked rather than wait forever.
 */
async function withCrossTabLock(run: () => Promise<boolean>): Promise<boolean> {
  const locks = getLockManager();
  if (!locks) return run();

  const controller = new AbortController();
  // Aborting only drops a request that is still *pending*; once the lock has been
  // granted the signal is ignored, so this can never cut a refresh short.
  const timer = setTimeout(() => controller.abort(), LOCK_WAIT_TIMEOUT_MS);

  try {
    return await locks.request(REFRESH_LOCK_NAME, { signal: controller.signal }, run);
  } catch (error) {
    if (isAbortError(error)) return run();
    // Anything else means the lock manager itself refused us; degrading is still
    // better than failing the refresh outright.
    return run();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Refreshes the session, collapsing concurrent callers onto a single request —
 * both within this tab and across every other tab on the origin.
 *
 * Resolves `true` when the cookies were rotated, `false` when the session is gone.
 */
export function refreshSession(fetcher: RefreshFetcher = defaultRefreshFetcher): Promise<boolean> {
  if (!inFlight) {
    // In-tab first, on purpose: it is synchronous and free, so a burst of 401s in
    // one page collapses before any of them queues for the cross-tab lock.
    inFlight = withCrossTabLock(() => runBounded(fetcher))
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
