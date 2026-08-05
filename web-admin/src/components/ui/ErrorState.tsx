'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  /** Muvaffaqiyatsiz so'rovdan kelgan xabar — o'zgartirilmay ko'rsatiladi. */
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
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'py-8' : 'py-14',
        className
      )}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-ds-md bg-danger-tint text-danger-deep dark:text-danger-light"
        aria-hidden="true"
      >
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="max-w-md">
        <p className="font-semibold text-ink">{title}</p>
        {message && <p className="mt-1 break-words text-body text-muted">{message}</p>}
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Qayta urinish
        </Button>
      )}
    </div>
  );
}
