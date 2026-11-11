/**
 * Sidebar collapse flag lives in a cookie (not localStorage): the server
 * layout reads it, so the first HTML already has the right rail width — no
 * flash on load and no hydration mismatch.
 */
export const SIDEBAR_COOKIE = 'angren-admin-sidebar';
export const SIDEBAR_COLLAPSED = '1';
