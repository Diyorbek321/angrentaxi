/**
 * Client-side view of the session.
 *
 * There is deliberately no `getAuthToken()` here any more. The access and refresh
 * tokens live in httpOnly cookies written by the /api/auth/* route handlers, which
 * means page scripts — including anything an XSS hole manages to run — cannot read
 * them. What is left on this side is the user profile, which is display data.
 *
 * Because of that, "am I logged in?" is now answered from the cached profile
 * rather than from a token. That is a UI hint only: the cookie is what the
 * middleware checks, and the backend is what actually decides.
 */

const USER_KEY = 'manager_user';

export interface ManagerUser {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

export function setUser(user: ManagerUser): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getUser(): ManagerUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ManagerUser;
  } catch {
    return null;
  }
}

export function clearUser(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_KEY);
  }
}

export function isAuthenticated(): boolean {
  return !!getUser();
}

/**
 * Revokes the refresh token server-side, then drops the local profile.
 *
 * The route handler clears the cookies and swallows backend failures, so the
 * browser always ends up logged out even when the API is unreachable.
 */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // Network failure must not leave the user stuck in a half-logged-in panel.
  } finally {
    clearUser();
  }
}
