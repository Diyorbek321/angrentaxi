/**
 * UI preference persistence shared by server layouts and the client shell.
 *
 * The sidebar collapse flag is a cookie, not localStorage, on purpose: the
 * server layout reads it and renders the correct rail width in the initial
 * HTML, so a collapsed sidebar never flashes open on load (localStorage can
 * only be read after mount — guaranteed flash, or a hydration mismatch).
 */
export const SIDEBAR_COOKIE = 'angren-dispatch-sidebar';
export const SIDEBAR_COLLAPSED = '1';

/** Client-side write; the next server render picks it up automatically. */
export function persistSidebarCollapsed(collapsed: boolean): void {
  try {
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? SIDEBAR_COLLAPSED : '0'}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* non-browser context — the toggle still works for this render */
  }
}
