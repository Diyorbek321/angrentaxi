/**
 * Common localhost origins used by local dev tooling (web app, mobile
 * emulators/simulators, Expo, etc). Only used as a fallback in development
 * when CORS_ORIGIN is not explicitly configured.
 */
const DEV_DEFAULT_ORIGINS: string[] = [
  'http://localhost:3000',
  'http://localhost:3001', // web-admin
  'http://localhost:3002', // web-manager
  'http://localhost:3003', // web-market
  'http://localhost:3004', // web-restaurant
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:3004',
];

/**
 * Resolves the CORS origin configuration for the app.
 *
 * - If `corsOrigin` is set, it is parsed as a comma-separated allow-list of
 *   explicit origins (whitespace around each entry is trimmed).
 * - If `corsOrigin` is unset in production, cross-origin requests are denied
 *   by default (`false`) rather than falling back to a wildcard, since a
 *   wildcard combined with `credentials: true` is unsafe and non-browser
 *   HTTP clients do not enforce the browser's rejection of that combination.
 * - If `corsOrigin` is unset outside production (e.g. development/test), a
 *   permissive list of common localhost origins is returned for developer
 *   convenience.
 */
export function resolveCorsOrigin(
  nodeEnv: string | undefined,
  corsOrigin: string | undefined,
): boolean | string[] {
  if (corsOrigin && corsOrigin.trim().length > 0) {
    return corsOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  if (nodeEnv === 'production') {
    return false;
  }

  return DEV_DEFAULT_ORIGINS;
}
