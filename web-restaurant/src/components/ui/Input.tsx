import { forwardRef, InputHTMLAttributes, ReactNode, useId } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Xato matni — `aria-describedby` orqali inputga bog'lanadi. */
  error?: string;
  hint?: string;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
  /** Raqam, narx, telefon — mono shrift bilan yaxshiroq o'qiladi. */
  mono?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, hint, leftElement, rightElement, mono = false, className, id, ...props },
    ref
  ) => {
    const autoId = useId();
    const inputId = id ?? `input-${autoId}`;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-caption font-semibold text-muted">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftElement && (
            <div className="absolute left-3 text-subtle pointer-events-none flex items-center" aria-hidden>
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={clsx(
              'w-full bg-surface border rounded-ds-sm text-ink placeholder-subtle text-body py-2.5',
              'transition-colors duration-fast ease-standard',
              'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted',
              mono && 'font-mono',
              error
                ? 'border-danger focus:border-danger'
                : 'border-line hover:border-line-strong focus:border-primary',
              leftElement ? 'pl-10' : 'pl-3.5',
              rightElement ? 'pr-10' : 'pr-3.5',
              className
            )}
            {...props}
          />
          {rightElement && <div className="absolute right-3 text-subtle flex items-center">{rightElement}</div>}
        </div>
        {/* Xato faqat rang bilan emas — matn bilan ham beriladi. */}
        {error && (
          <p id={errorId} className="text-caption text-danger-deep dark:text-danger-light">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-caption text-subtle">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
