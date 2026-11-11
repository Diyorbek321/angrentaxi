// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import type { ComponentType, ReactNode } from 'react';

export interface NavIconProps {
  size?: number | string;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export interface NavItem {
  href: string;
  /** Short (fits one line at 240px). Long names get truncated + tooltip. */
  label: string;
  icon: ComponentType<NavIconProps>;
  /** RBAC permission required; `null`/omitted = always visible. */
  permission?: string | null;
  /** Count badge; 0/null/undefined hides it (no always-on badges). */
  badge?: number | null;
  /** `danger` only for exceptions/critical queues; everything else neutral. */
  badgeTone?: 'neutral' | 'danger';
  /** Match the path exactly (e.g. `/dispatch`, which prefixes every route). */
  exact?: boolean;
  /** Extra path prefixes that also mark this item active. */
  activePrefixes?: string[];
}

export interface NavGroup {
  /** 11px uppercase caption; omit for an untitled first group. */
  title?: string;
  items: NavItem[];
}

export interface ShellUser {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  /** Human role label ("Dispetcher", "Administrator"). */
  role?: string | null;
}

export interface ShellBrand {
  name: string;
  /** Panel name under the brand ("Dispetcher"). */
  subtitle?: string;
  href: string;
  /** 28px mark; defaults to a neutral monogram. */
  logo?: ReactNode;
}
