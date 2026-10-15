// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  /** Raw message from the failed request — shown verbatim, never swallowed. */
  message?: string | null;
  onRetry?: () => void | Promise<void>;
  /** Shows a spinner on the retry button. */
  retrying?: boolean;
  className?: string;
  compact?: boolean;
}

/**
 * Nothing to show because loading failed: what broke + "Qayta urinish".
 * If last good data exists, keep it on screen and use RetryBanner instead.
 */
export function ErrorState({
  title = 'Maʼlumotni yuklab boʻlmadi',
  message,
  onRetry,
  retrying = false,
  className,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3 px-4',
        compact ? 'py-8' : 'py-14',
        className
      )}
    >
      <div
        aria-hidden
        className="h-10 w-10 rounded-full border border-danger/30 bg-danger-tint text-danger flex items-center justify-center"
      >
        <AlertTriangle size={18} />
      </div>
      <div className="max-w-md">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {message && <p className="text-[13px] text-muted mt-1 break-words">{message}</p>}
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void onRetry()}
          isLoading={retrying}
          leftIcon={<RefreshCw size={13} aria-hidden />}
        >
          Qayta urinish
        </Button>
      )}
    </div>
  );
}
