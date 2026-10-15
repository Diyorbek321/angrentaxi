// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';
import { formatTime } from '@/lib/format';

export interface RetryBannerProps {
  /** What failed, named plainly ("Buyurtmalarni yangilab boʻlmadi."). */
  message?: string | null;
  onRetry: () => void | Promise<void>;
  /** Last good data is still on screen below — say so. */
  keepsLastData?: boolean;
  /** When that last good data was loaded (ms epoch / Date). */
  lastUpdatedAt?: number | Date | null;
  /** Spinner on the retry button (aliases: `retrying`, `isRetrying`). */
  retrying?: boolean;
  isRetrying?: boolean;
  /** Custom headline (default: generic "could not refresh"). */
  title?: string;
  className?: string;
}

/**
 * Inline banner for a failed REFRESH: names the failure, keeps the last good
 * data visible underneath, offers retry. For a failure with nothing to show,
 * use ErrorState. Canonical for RetryBanner / DataErrorBanner / StaleDataBanner.
 */
export function RetryBanner({
  message,
  onRetry,
  keepsLastData = false,
  lastUpdatedAt,
  retrying,
  isRetrying,
  title,
  className,
}: RetryBannerProps) {
  const busy = retrying ?? isRetrying ?? false;
  const at = lastUpdatedAt != null ? formatTime(lastUpdatedAt) : null;
  const headline = title ?? message ?? 'Maʼlumotni yangilab boʻlmadi.';
  const detail = title ? message : null;
  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-3 rounded-ds-md border border-danger/30 bg-danger-tint px-3 py-2',
        className
      )}
    >
      <AlertTriangle size={15} aria-hidden className="text-danger shrink-0" />
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="text-danger-dark dark:text-danger-light font-medium">{headline}</p>
        {(detail || keepsLastData) && (
          <p className="text-muted truncate">
            {detail}
            {detail && keepsLastData && ' · '}
            {keepsLastData && (at ? `Ekranda ${at} holatidagi maʼlumot.` : 'Ekranda oxirgi yuklangan maʼlumot.')}
          </p>
        )}
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => void onRetry()}
        isLoading={busy}
        leftIcon={<RefreshCw size={13} aria-hidden />}
      >
        Qayta urinish
      </Button>
    </div>
  );
}
