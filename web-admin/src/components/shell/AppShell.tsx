// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '../ui/cn';
import type { DropdownItem } from '../ui/DropdownMenu';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { filterNav, writeCollapseCookie } from './nav-utils';
import type { NavGroup, ShellBrand, ShellUser } from './types';

export interface AppShellProps {
  brand: ShellBrand;
  /** Full nav config; filtered here by `can`. */
  nav: readonly NavGroup[];
  /** RBAC check; omit to show every item. Return false while permissions load. */
  can?: (permission: string) => boolean;
  /** `undefined` hides the user UI; `null` = loading/unknown user. */
  user?: ShellUser | null;
  onLogout?: () => void | Promise<void>;
  userMenuItems?: DropdownItem[];
  /** Topbar left slot (live counters + LiveStatus). */
  live?: ReactNode;
  /** Topbar right slot. */
  actions?: ReactNode;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
  /**
   * Read the collapse cookie in the SERVER layout and pass it here, so the
   * first HTML already has the right width (no flash).
   */
  initialCollapsed?: boolean;
  /** Cookie name the collapse flag is written to. */
  collapseCookie: string;
  /**
   * Full-width strip between the topbar and <main> (e.g. "Qabul yopiq"
   * pause banner). Stays put while the page scrolls.
   */
  banner?: ReactNode;
  /** Classes for <main>. Default scrolls; pass `overflow-hidden` for full-bleed maps. */
  mainClassName?: string;
  /** Wrap children in the standard page padding (px-6 py-5). Default false. */
  padded?: boolean;
  children: ReactNode;
}

/** Sidebar + topbar frame shared by every panel. Auth stays outside (props only). */
export function AppShell({
  brand,
  nav,
  can,
  user,
  onLogout,
  userMenuItems,
  live,
  actions,
  onSearch,
  searchPlaceholder,
  initialCollapsed = false,
  collapseCookie,
  banner,
  mainClassName,
  padded = false,
  children,
}: AppShellProps) {
  const pathname = usePathname() ?? '';
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapseCookie(collapseCookie, next);
      return next;
    });
  }, [collapseCookie]);

  // `[` toggles the rail (Linear-style), ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      toggleCollapsed();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCollapsed]);

  const groups = useMemo(() => filterNav(nav, can), [nav, can]);

  return (
    <div className="h-screen flex bg-bg overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-ds-sm focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop"
      >
        Asosiy kontentga oʻtish
      </a>
      <Sidebar
        brand={brand}
        groups={groups}
        pathname={pathname}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        user={user}
        onLogout={onLogout}
        userMenuItems={userMenuItems}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          live={live}
          actions={actions}
          onSearch={onSearch}
          searchPlaceholder={searchPlaceholder}
          user={user}
          onLogout={onLogout}
          userMenuItems={userMenuItems}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        {banner ? <div className="shrink-0">{banner}</div> : null}
        <main id="main" tabIndex={-1} className={cn('flex-1 min-h-0 overflow-y-auto focus:outline-none', mainClassName)}>
          {padded ? <div className="px-4 sm:px-6 py-5">{children}</div> : children}
        </main>
      </div>
    </div>
  );
}
