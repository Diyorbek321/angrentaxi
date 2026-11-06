// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { fullName } from '@/lib/format';
import type { NavGroup, NavItem, ShellUser } from './types';
import { kitT } from '@/lib/i18n/kit-messages';

export function isNavItemActive(pathname: string, item: Pick<NavItem, 'href' | 'exact' | 'activePrefixes'>): boolean {
  if (pathname === item.href) return true;
  if (item.exact) return false;
  if (pathname.startsWith(`${item.href}/`)) return true;
  return (item.activePrefixes ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Hide (never disable) what the user may not use. Groups that end up empty
 * drop their caption too. `can` undefined = show everything.
 */
export function filterNav(groups: readonly NavGroup[], can?: (permission: string) => boolean): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.permission || !can || can(i.permission)),
    }))
    .filter((g) => g.items.length > 0);
}

export function shellUserName(user: ShellUser | null | undefined): string {
  if (!user) return '—';
  if (user.name && user.name.trim() && !/^(null|undefined)(\s+(null|undefined))?$/.test(user.name.trim())) {
    return user.name.trim();
  }
  const n = fullName(user.firstName, user.lastName, '');
  return n || user.phone || kitT().shell.userFallback;
}

/** Client-side cookie write for the collapse flag; the server layout reads it. */
export function writeCollapseCookie(name: string, collapsed: boolean): void {
  try {
    document.cookie = `${name}=${collapsed ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* non-browser context */
  }
}
