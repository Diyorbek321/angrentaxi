// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { RetryBanner } from './RetryBanner';
import { LiveStatus } from '../shell/LiveStatus';

export interface PollStatusProps {
  lastUpdatedAt: number | null;
  isRefreshing: boolean;
  /** Manual refresh (topbar ↻). Omit to show the status pill only. */
  onRefresh?: () => void | Promise<void>;
  /** Poll failing → "Eskirgan". */
  error?: string | null;
  className?: string;
}

/**
 * Polling freshness readout + optional manual refresh (market, restaurant). Shows the
 * shared LiveStatus pill ("Jonli · 10:42 holatiga"). Put it ONCE per screen
 * — in the topbar live slot — never next to every card.
 */
export function PollStatus({ lastUpdatedAt, isRefreshing, onRefresh, error, className }: PollStatusProps) {
  const state = error ? 'stale' : isRefreshing && lastUpdatedAt == null ? 'connecting' : 'live';
  return (
    <LiveStatus
      state={state}
      updatedAt={lastUpdatedAt}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      className={className}
    />
  );
}

export interface StaleDataBannerProps {
  error: string | null;
  lastUpdatedAt: number | null;
  onRetry: () => void | Promise<void>;
  isRetrying?: boolean;
  className?: string;
}

/** Poll failed but old data is still shown. Renders nothing without an error. */
export function StaleDataBanner({ error, lastUpdatedAt, onRetry, isRetrying = false, className }: StaleDataBannerProps) {
  if (!error) return null;
  return (
    <RetryBanner
      title="Aloqa uzildi — yangilanish muvaffaqiyatsiz"
      message={error}
      onRetry={onRetry}
      isRetrying={isRetrying}
      keepsLastData
      lastUpdatedAt={lastUpdatedAt}
      className={className}
    />
  );
}
