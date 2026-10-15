// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LogOut, Menu, Search } from 'lucide-react';
import { cn } from '../ui/cn';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/IconButton';
import { Kbd } from '../ui/Kbd';
import { ThemeToggle } from '../ui/ThemeToggle';
import { DropdownMenu, type DropdownItem } from '../ui/DropdownMenu';
import { shellUserName } from './nav-utils';
import type { ShellUser } from './types';

export interface TopbarProps {
  /** Left slot: panel-specific live readouts + the single LiveStatus. */
  live?: ReactNode;
  /** Right slot, before search/theme/profile (e.g. a notifications bell). */
  actions?: ReactNode;
  /** Enables the built-in search box (⌘K / Ctrl+K focuses it). */
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
  /** Show the built-in theme toggle (default true). */
  showThemeToggle?: boolean;
  user?: ShellUser | null;
  onLogout?: () => void | Promise<void>;
  userMenuItems?: DropdownItem[];
  /** Hamburger (< lg). */
  onOpenMobileNav?: () => void;
  className?: string;
}

function SearchBox({ onSearch, placeholder }: { onSearch: (q: string) => void; placeholder: string }) {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (v) onSearch(v);
      }}
      className="relative hidden sm:flex items-center"
    >
      <Search size={15} aria-hidden className="absolute left-2.5 text-subtle pointer-events-none" />
      <input
        ref={ref}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && (setQ(''), ref.current?.blur())}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'h-8 w-44 lg:w-64 rounded-ds-sm border border-line bg-surface-2/60 pl-8 pr-12 text-[13px] text-ink',
          'placeholder:text-subtle transition-colors hover:border-line-strong',
          'focus:outline-none focus:bg-surface focus:ring-2 focus:ring-focus/30 focus:border-focus',
          '[&::-webkit-search-cancel-button]:appearance-none'
        )}
      />
      {!q && <Kbd className="absolute right-2 pointer-events-none">{isMac ? '⌘K' : 'Ctrl K'}</Kbd>}
    </form>
  );
}

/**
 * 56px topbar. Left: `live` slot. Right: `actions`, search (⌘K), theme,
 * profile menu. The page title is NOT here (it lives in PageHeader).
 */
export function Topbar({
  live,
  actions,
  onSearch,
  searchPlaceholder = 'Qidirish…',
  showThemeToggle = true,
  user,
  onLogout,
  userMenuItems = [],
  onOpenMobileNav,
  className,
}: TopbarProps) {
  const name = shellUserName(user);
  const items: DropdownItem[] = [
    ...userMenuItems,
    ...(userMenuItems.length && onLogout ? [{ type: 'separator' as const }] : []),
    ...(onLogout ? [{ label: 'Chiqish', icon: <LogOut aria-hidden />, danger: true, onSelect: () => void onLogout() }] : []),
  ];

  return (
    <header
      className={cn(
        'h-14 shrink-0 flex items-center gap-2 px-3 sm:px-4 bg-surface border-b border-line',
        className
      )}
    >
      {onOpenMobileNav && (
        <IconButton aria-label="Menyuni ochish" onClick={onOpenMobileNav} className="lg:hidden">
          <Menu aria-hidden />
        </IconButton>
      )}

      <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">{live}</div>

      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        {onSearch && <SearchBox onSearch={onSearch} placeholder={searchPlaceholder} />}
        {actions}
        {showThemeToggle && <ThemeToggle />}
        {user !== undefined && (
          <DropdownMenu
            items={items}
            minWidth={220}
            header={
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink truncate">{name}</p>
                {user?.role && <p className="text-xs text-muted truncate">{user.role}</p>}
              </div>
            }
            trigger={(p) => (
              <button
                type="button"
                {...p}
                aria-label={`Profil: ${name}`}
                className="ml-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <Avatar name={name === '—' ? null : name} size="md" />
              </button>
            )}
          />
        )}
      </div>
    </header>
  );
}
