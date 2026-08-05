import Cookies from 'js-cookie';
import { VendorUser } from './api';

/**
 * Client-side view of the session.
 *
 * There is deliberately no token accessor here any more. The access and refresh
 * tokens live in httpOnly cookies written by the /api/auth/* route handlers, so
 * page scripts — including anything an XSS hole manages to run — cannot read
 * them. What is left on this side is the user profile, which is display data.
 *
 * `isAuthenticated()` therefore answers from the cached profile rather than from
 * a token. That is a UI hint only: the cookie is what the middleware checks, and
 * the backend is what actually decides.
 */

const USER_KEY = 'vendor_user';

const COOKIE_OPTIONS = {
  expires: 7,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

export const authStorage = {
  getUser(): VendorUser | null {
    if (typeof window === 'undefined') return null;
    const raw = Cookies.get(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as VendorUser;
    } catch {
      return null;
    }
  },

  setUser(user: VendorUser): void {
    Cookies.set(USER_KEY, JSON.stringify(user), COOKIE_OPTIONS);
  },

  removeUser(): void {
    Cookies.remove(USER_KEY);
  },

  isAuthenticated(): boolean {
    return !!this.getUser();
  },

  /**
   * Only clears what this side owns. The httpOnly session cookies can only be
   * removed by the server, which /api/auth/logout does.
   */
  clearAll(): void {
    this.removeUser();
  },
};

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 9) {
    return `+998${digits}`;
  }
  return phone;
}

export function isValidUzPhone(phone: string): boolean {
  const normalized = formatPhone(phone);
  return /^\+998[0-9]{9}$/.test(normalized);
}
