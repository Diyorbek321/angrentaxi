'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  /** Raw message from the failed request — shown verbatim, never swallowed. */
  message?: string | null;
  onRetry?: () => void | Promise<void>;
  className?: string;
  compact?: boolean;
}

export function ErrorState({
  title = 'Maʼlumotni yuklab boʻlmadi',
  message,
  onRetry,
  className,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={clsx(
        'flex flex-col items-center justify-center text-center gap-3',
        compact ? 'py-8' : 'py-14',
        className
      )}
    >
      <div className="h-12 w-12 rounded-2xl bg-danger/12 text-danger flex items-center justify-center">
        <AlertTriangle size={22} />
      </div>
      <div className="max-w-md">
        <p className="font-semibold text-ink">{title}</p>
        {message && <p className="text-sm text-muted mt-1 break-words">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw size={13} />}>
          Qayta urinish
        </Button>
      )}
    </div>
  );
}
