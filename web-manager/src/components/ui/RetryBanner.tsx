'use client';

import { AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './Button';
import { formatTime } from '@/lib/format';

export interface RetryBannerProps {
  /** What failed, named plainly ("Buyurtmalarni yangilab boʻlmadi."). */
  message: string;
  onRetry: () => void | Promise<void>;
  /**
   * True when the last good data is still on screen below the banner — the
   * banner then says so, so the operator knows the rows are a snapshot, not
   * live. A failed refresh must never silently blank the screen.
   */
  keepsLastData?: boolean;
  className?: string;
}

/**
 * Inline error banner for a failed *refresh*: names the failure, keeps the
 * last good data visible underneath, offers retry (states-trio rule). For a
 * failure with nothing to show, use ErrorState instead.
 */
export function RetryBanner({ message, onRetry, keepsLastData = false, className }: RetryBannerProps) {
  return (
    <div
      role="alert"
      className={clsx(
        'flex items-center gap-2.5 rounded-ds-xs border border-danger/40 bg-danger-tint px-3 py-2',
        className
      )}
    >
      <AlertTriangle size={14} className="text-danger shrink-0" />
      <p className="text-xs text-danger-deep dark:text-danger-light flex-1">
        {message}
        {keepsLastData && (
          <span className="text-muted">
            {' '}
            Quyida oxirgi muvaffaqiyatli yuklangan maʼlumot koʻrsatilmoqda
            {` (${formatTime(Date.now())} dan oldingi holat)`}.
          </span>
        )}
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Qayta urinish
      </Button>
    </div>
  );
}
