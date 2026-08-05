import { forwardRef, TextareaHTMLAttributes, useId } from 'react';
import { clsx } from 'clsx';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const autoId = useId();
    const areaId = id ?? `textarea-${autoId}`;
    const errorId = `${areaId}-error`;
    const hintId = `${areaId}-hint`;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={areaId} className="text-caption font-semibold text-muted">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={clsx(
            'w-full bg-surface border rounded-ds-sm text-ink placeholder-subtle text-body px-3.5 py-2.5',
            'transition-colors duration-fast ease-standard resize-y min-h-[76px]',
            'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted',
            error
              ? 'border-danger focus:border-danger'
              : 'border-line hover:border-line-strong focus:border-primary',
            className
          )}
          {...props}
        />
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

Textarea.displayName = 'Textarea';

export { Textarea };
