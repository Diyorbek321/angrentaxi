/**
 * Where the stack under test lives and which seeded accounts drive it.
 *
 * Defaults match the local dev stack (`npm run dev` in each panel, backend on
 * :3000, seed data from backend/src/database/seeds). Every value can be
 * overridden from the environment to point the suite at another stack.
 */

export type PanelName = 'admin' | 'manager' | 'market' | 'restaurant';

export interface PanelConfig {
  name: PanelName;
  baseURL: string;
  phone: string;
  /** Proxy path that answers 200 only for a live session of this panel's role. */
  sessionProbe: string;
  /** Where the panel lands after login. */
  home: string;
}

const env = (key: string, fallback: string): string => process.env[key] || fallback;

export const API_URL = env('E2E_API_URL', 'http://localhost:3000/api/v1');

// The backend's OTP bypass code (OTP_BYPASS_CODE in backend/.env). The suite
// cannot run against a stack that sends real SMS.
export const OTP_CODE = env('E2E_OTP_CODE', '123456');

export const PANELS: Record<PanelName, PanelConfig> = {
  admin: {
    name: 'admin',
    baseURL: env('E2E_ADMIN_URL', 'http://localhost:3001'),
    phone: env('E2E_ADMIN_PHONE', '+998901234567'),
    sessionProbe: '/api/proxy/users/me',
    home: '/dashboard',
  },
  manager: {
    name: 'manager',
    baseURL: env('E2E_MANAGER_URL', 'http://localhost:3002'),
    phone: env('E2E_MANAGER_PHONE', '+998901234568'),
    sessionProbe: '/api/proxy/users/me',
    home: '/dispatch',
  },
  market: {
    name: 'market',
    baseURL: env('E2E_MARKET_URL', 'http://localhost:3003'),
    phone: env('E2E_MARKET_PHONE', '+998901234573'),
    sessionProbe: '/api/proxy/market/vendor/store',
    home: '/dashboard',
  },
  restaurant: {
    name: 'restaurant',
    baseURL: env('E2E_RESTAURANT_URL', 'http://localhost:3004'),
    phone: env('E2E_RESTAURANT_PHONE', '+998901234574'),
    sessionProbe: '/api/proxy/food/vendor/restaurant',
    home: '/dashboard',
  },
};

// Places the orders the vendor panels then work through — stands in for the
// mobile app. Seeded passenger; deliberately not the one used for manual QA.
export const PASSENGER_PHONE = env('E2E_PASSENGER_PHONE', '+998901234570');

export const authFile = (name: PanelName | 'passenger'): string => `.auth/${name}.json`;

/** Unique, recognisable label for data a test creates. */
export const uniqueName = (label: string): string =>
  `E2E ${label} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
