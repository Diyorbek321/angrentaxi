import { forwardRef, SelectHTMLAttributes, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: readonly SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className, id, ...props }, ref) => {
    const autoId = useId();
    const selectId = id ?? `select-${autoId}`;
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-caption font-semibold text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={clsx(
              'w-full bg-surface border rounded-ds-sm text-ink text-body pl-3.5 pr-10 py-2.5',
              'transition-colors duration-fast ease-standard appearance-none',
              'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted',
              error
                ? 'border-danger focus:border-danger'
                : 'border-line hover:border-line-strong focus:border-primary',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            aria-hidden
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none"
          />
        </div>
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

Select.displayName = 'Select';

export { Select };
