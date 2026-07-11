import Cookies from 'js-cookie';
import { VendorUser } from './api';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'restaurant_user';

const COOKIE_OPTIONS = {
  expires: 7,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

export const authStorage = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return Cookies.get(TOKEN_KEY) || null;
  },

  setToken(token: string): void {
    Cookies.set(TOKEN_KEY, token, COOKIE_OPTIONS);
  },

  removeToken(): void {
    Cookies.remove(TOKEN_KEY);
  },

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
    return !!this.getToken();
  },

  clearAll(): void {
    this.removeToken();
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
