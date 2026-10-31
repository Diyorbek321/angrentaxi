// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { RetryBanner } from './RetryBanner';
import { kitT } from '@/lib/i18n/kit-messages';

export interface DataErrorBannerProps {
  message?: string | null;
  onRetry: () => void | Promise<void>;
  retrying?: boolean;
  lastUpdatedAt?: number | Date | null;
  className?: string;
}

/** web-market name — a RetryBanner that keeps the last good data on screen. */
export function DataErrorBanner({ message, onRetry, retrying = false, lastUpdatedAt, className }: DataErrorBannerProps) {
  return (
    <RetryBanner
      title={kitT().retryBanner.refreshFailed}
      message={message}
      onRetry={onRetry}
      retrying={retrying}
      keepsLastData
      lastUpdatedAt={lastUpdatedAt}
      className={className ?? 'mb-4'}
    />
  );
}
