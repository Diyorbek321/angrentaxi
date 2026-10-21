// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { RotateCw } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './IconButton';
import { kitT } from '@/lib/i18n/kit-messages';

export interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
  className?: string;
}

/** Topbar ↻ next to LiveStatus — reloads the shell AND the current page's data. */
export function RefreshButton({ onRefresh, isRefreshing = false, className }: RefreshButtonProps) {
  return (
    <IconButton
      aria-label={kitT().common.refresh}
      size="sm"
      onClick={() => void onRefresh()}
      disabled={isRefreshing}
      className={className}
    >
      <RotateCw aria-hidden className={cn(isRefreshing && 'animate-spin')} />
    </IconButton>
  );
}
