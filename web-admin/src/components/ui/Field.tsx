// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import type { ReactNode } from 'react';
import { cn } from './cn';

/** Shared control chrome: 32px, 8px radius, hairline, focus ring. */
export const controlBase = cn(
  'w-full bg-surface border rounded-ds-sm text-ink text-sm placeholder:text-subtle',
  'focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus',
  'disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-2',
  'transition-colors'
);

export const controlBorder = (error?: boolean) =>
  error ? 'border-danger/70 focus:ring-danger/25 focus:border-danger' : 'border-line hover:border-line-strong';

export interface FieldProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label (13px/500) · control · hint or error (12px). */
export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5 min-w-0', className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-ink">
          {label}
          {required && <span className="text-danger ml-0.5" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger-dark dark:text-danger-light">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, error?: unknown, hint?: unknown): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
