import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const generatedId = React.useId();
    const areaId = id || `textarea-${generatedId}`;
    const errorId = `${areaId}-error`;
    const hintId = `${areaId}-hint`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={areaId} className="mb-1.5 block text-caption font-medium text-muted">
            {label}
          </label>
        )}
        <textarea
          id={areaId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            'min-h-[80px] w-full resize-y rounded-ds-md border bg-surface px-3 py-2 text-body text-ink',
            'placeholder:text-subtle',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted',
            'transition-colors duration-fast',
            error
              ? 'border-danger focus:border-danger'
              : 'border-line hover:border-line-strong focus:border-primary',
            className
          )}
          {...props}
        />
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
Textarea.displayName = 'Textarea';

export { Textarea };
