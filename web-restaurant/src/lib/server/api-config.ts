/**
 * Backend base URL as seen from the Next.js server (route handlers), not the browser.
 *
 * `API_URL` is read at runtime so the container can be repointed without a rebuild;
 * `NEXT_PUBLIC_API_URL` is inlined at build time and kept as the fallback so existing
 * Railway/Docker setups keep working untouched.
 */
export const API_BASE_URL = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000/api/v1'
).replace(/\/+$/, '');
