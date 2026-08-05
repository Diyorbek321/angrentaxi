import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Raqam, ID, telefon va narxlar mono shriftda yaxshiroq o'qiladi. */
  mono?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, label, error, hint, leftIcon, rightIcon, mono = false, id, ...props },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || `input-${generatedId}`;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-caption font-medium text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-subtle">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={cn(
              'flex h-10 w-full rounded-ds-md border bg-surface px-3 py-2 text-body text-ink',
              'placeholder:text-subtle',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted',
              'transition-colors duration-fast',
              mono && 'font-mono',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error
                ? 'border-danger focus:border-danger'
                : 'border-line hover:border-line-strong focus:border-primary',
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-subtle">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-caption text-danger-deep dark:text-danger-light">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-caption text-subtle">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
