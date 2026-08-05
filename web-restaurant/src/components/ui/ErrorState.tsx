'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  /** So'rovdan kelgan xabar — yashirilmaydi, ko'rsatiladi. */
  message?: string | null;
  onRetry?: () => void | Promise<void>;
  compact?: boolean;
  className?: string;
}

/**
 * `role="alert"` — xato paydo bo'lganda skrinrider uni darhol o'qiydi.
 * Xato faqat qizil rang bilan emas, ikonka va matn bilan ham beriladi.
 */
export function ErrorState({
  title = "Ma'lumotni yuklab bo'lmadi",
  message,
  onRetry,
  compact = false,
  className,
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
      <div
        aria-hidden
        className="h-12 w-12 rounded-ds-md bg-danger-tint text-danger-deep dark:text-danger-light flex items-center justify-center"
      >
        <AlertTriangle size={22} />
      </div>
      <div className="max-w-md">
        <p className="text-h3 text-ink">{title}</p>
        {message && <p className="text-body text-muted mt-1 break-words">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="md" onClick={onRetry} leftIcon={<RefreshCw size={14} />}>
          Qayta urinish
        </Button>
      )}
    </div>
  );
}
