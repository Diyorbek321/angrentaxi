// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import Link from 'next/link';
import { ChevronsLeft, ChevronsRight, ChevronsUpDown, LogOut } from 'lucide-react';
import { cn } from '../ui/cn';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { DropdownMenu, type DropdownItem } from '../ui/DropdownMenu';
import { isNavItemActive, shellUserName } from './nav-utils';
import type { NavGroup, NavItem, ShellBrand, ShellUser } from './types';

export interface SidebarProps {
  brand: ShellBrand;
  /** Already RBAC-filtered (see `filterNav`). */
  groups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  user?: ShellUser | null;
  onLogout?: () => void | Promise<void>;
  /** Extra entries in the user menu, above "Chiqish". */
  userMenuItems?: DropdownItem[];
  /** < lg: the sidebar is an overlay drawer. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function BrandMark({ brand }: { brand: ShellBrand }) {
  if (brand.logo) return <>{brand.logo}</>;
  return (
    <span
      aria-hidden
      className="h-7 w-7 shrink-0 rounded-ds-sm bg-primary text-white flex items-center justify-center text-[13px] font-bold dark:bg-primary-on-dark"
    >
      {brand.name.charAt(0).toUpperCase()}
    </span>
  );
}

function CountBadge({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  if (!item.badge || item.badge <= 0) return null;
  const danger = item.badgeTone === 'danger';
  if (collapsed) {
    return (
      <span
        aria-hidden
        className={cn(
          'absolute top-1 right-1 h-2 w-2 rounded-full ring-2 ring-surface',
          danger ? 'bg-danger' : 'bg-subtle'
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        'num ml-auto shrink-0 min-w-[20px] h-[18px] px-1.5 rounded-ds-xs text-[11px] font-semibold leading-[18px] text-center',
        danger ? 'bg-danger text-white' : 'bg-surface-3 text-muted'
      )}
    >
      {item.badge > 99 ? '99+' : item.badge}
    </span>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const badgeText = item.badge && item.badge > 0 ? ` (${item.badge})` : '';
  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? `${item.label}${badgeText}` : undefined}
      title={collapsed ? undefined : item.label}
      onClick={onNavigate}
      className={cn(
        'group relative flex items-center gap-2.5 h-8 rounded-ds-sm text-[13.5px] transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
        collapsed ? 'justify-center w-9 mx-auto' : 'px-2.5',
        active ? 'bg-surface-2 text-ink font-semibold' : 'text-muted hover:bg-surface-2 hover:text-ink'
      )}
    >
      {active && (
        <span aria-hidden className="absolute -left-2 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary dark:bg-mint" />
      )}
      <Icon size={16} aria-hidden className={cn('shrink-0', active ? 'text-ink' : 'text-subtle group-hover:text-muted')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      <CountBadge item={item} collapsed={collapsed} />
    </Link>
  );
  return (
    <Tooltip content={`${item.label}${badgeText}`} side="right" disabled={!collapsed} delay={100}>
      {link}
    </Tooltip>
  );
}

/**
 * Config-driven sidebar: 240px / 56px rail. Groups → items (icon, label,
 * badge). Collapse toggle + user card (avatar, name, role, logout menu) at
 * the bottom. Under `lg` it is an overlay drawer.
 */
export function Sidebar({
  brand,
  groups,
  pathname,
  collapsed,
  onToggleCollapsed,
  user,
  onLogout,
  userMenuItems = [],
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  // The rail only applies on desktop; the mobile drawer is always expanded.
  const rail = collapsed && !mobileOpen;
  const name = shellUserName(user);

  const menuItems: DropdownItem[] = [
    ...userMenuItems,
    ...(userMenuItems.length && onLogout ? [{ type: 'separator' as const }] : []),
    ...(onLogout
      ? [{ label: 'Chiqish', icon: <LogOut aria-hidden />, danger: true, onSelect: () => void onLogout() }]
      : []),
  ];

  return (
    <>
      {mobileOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-30 bg-scrim/55 lg:hidden animate-fade-in"
          onClick={onCloseMobile}
        />
      )}

      <aside
        aria-label="Yon panel"
        className={cn(
          'z-40 shrink-0 flex flex-col bg-surface border-r border-line',
          'fixed inset-y-0 left-0 lg:static transition-[width,transform] duration-200 ease-standard',
          rail ? 'w-rail' : 'w-sidebar',
          mobileOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand */}
        <div className={cn('h-14 shrink-0 flex items-center border-b border-line', rail ? 'justify-center' : 'px-4')}>
          <Link
            href={brand.href}
            onClick={onCloseMobile}
            aria-label={`${brand.name}${brand.subtitle ? ` — ${brand.subtitle}` : ''}`}
            className="flex items-center gap-2.5 min-w-0 rounded-ds-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <BrandMark brand={brand} />
            {!rail && (
              <span className="min-w-0 leading-tight">
                <span className="block text-sm font-semibold text-ink truncate">{brand.name}</span>
                {brand.subtitle && <span className="block text-[11px] text-subtle truncate">{brand.subtitle}</span>}
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav aria-label="Asosiy navigatsiya" className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
          {groups.map((group, gi) => (
            <div key={group.title ?? `g${gi}`} className={gi > 0 ? 'mt-4' : undefined}>
              {group.title &&
                (rail ? (
                  gi > 0 && <div role="presentation" className="mx-2 mb-3 border-t border-line" />
                ) : (
                  <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-subtle truncate">
                    {group.title}
                  </p>
                ))}
              <ul className="space-y-px">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={isNavItemActive(pathname, item)}
                      collapsed={rail}
                      onNavigate={onCloseMobile}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom: collapse + user */}
        <div className="shrink-0 border-t border-line p-2 space-y-1">
          <Tooltip content="Panelni yoyish" side="right" disabled={!rail}>
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={rail ? 'Panelni yoyish' : 'Panelni yigʻish'}
              aria-expanded={!rail}
              className={cn(
                'hidden lg:flex items-center gap-2.5 h-8 rounded-ds-sm text-[13px] text-muted',
                'hover:bg-surface-2 hover:text-ink transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                rail ? 'w-9 mx-auto justify-center' : 'w-full px-2.5'
              )}
            >
              {rail ? <ChevronsRight size={16} aria-hidden /> : <ChevronsLeft size={16} aria-hidden />}
              {!rail && <span>Yigʻish</span>}
            </button>
          </Tooltip>

          {user !== undefined && (
            <DropdownMenu
              side="top"
              align="start"
              minWidth={208}
              items={menuItems}
              header={
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{name}</p>
                  {user?.phone && <p className="num text-xs text-muted truncate">{user.phone}</p>}
                </div>
              }
              trigger={(p) => (
                <button
                  type="button"
                  {...p}
                  ref={p.ref}
                  aria-label={`Foydalanuvchi menyusi: ${name}`}
                  className={cn(
                    'flex items-center gap-2.5 rounded-ds-sm text-left transition-colors hover:bg-surface-2',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                    rail ? 'w-9 h-9 mx-auto justify-center' : 'w-full h-11 px-2'
                  )}
                >
                  <Avatar name={name === '—' ? null : name} size="md" />
                  {!rail && (
                    <>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block text-[13px] font-medium text-ink truncate">{name}</span>
                        {user?.role && <span className="block text-[11px] text-subtle truncate">{user.role}</span>}
                      </span>
                      <ChevronsUpDown size={14} aria-hidden className="text-subtle shrink-0" />
                    </>
                  )}
                </button>
              )}
            />
          )}
        </div>
      </aside>
    </>
  );
}
