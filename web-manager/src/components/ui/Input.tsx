import { forwardRef, InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  /** Numbers, ids, phones and prices read better in the mono face. */
  mono?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, hint, leftElement, rightElement, mono = false, className, id, ...props },
    ref
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-muted">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftElement && (
            <div className="absolute left-3 text-subtle pointer-events-none flex items-center">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full bg-surface border rounded-lg text-ink placeholder-subtle text-sm py-2',
              'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-2',
              'transition-colors',
              mono && 'font-mono',
              error ? 'border-danger/60 focus:ring-danger/30 focus:border-danger' : 'border-line hover:border-line-strong',
              leftElement ? 'pl-9' : 'pl-3',
              rightElement ? 'pr-9' : 'pr-3',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 text-subtle flex items-center">{rightElement}</div>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {hint && !error && <p className="text-xs text-subtle">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
