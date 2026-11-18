// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { useId, type ReactNode } from 'react';
import { cn } from './cn';

export interface RadioOption<T extends string = string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<T extends string = string> {
  options: readonly RadioOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  name?: string;
  label?: ReactNode;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

/** Native radios (arrow keys for free), custom 16px look. */
export function RadioGroup<T extends string = string>({
  options,
  value,
  onChange,
  name,
  label,
  orientation = 'vertical',
  className,
}: RadioGroupProps<T>) {
  const auto = useId();
  const groupName = name ?? auto;
  return (
    <fieldset className={cn('min-w-0', className)}>
      {label && <legend className="mb-2 text-[13px] font-medium text-ink">{label}</legend>}
      <div className={cn('flex gap-2', orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap gap-x-4')}>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn('inline-flex items-start gap-2 cursor-pointer', o.disabled && 'opacity-50 cursor-not-allowed')}
          >
            <input
              type="radio"
              name={groupName}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className={cn(
                'mt-0.5 appearance-none h-4 w-4 shrink-0 rounded-full border border-line-strong bg-surface transition-colors',
                'checked:border-[5px] checked:border-primary dark:checked:border-primary-on-dark',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface'
              )}
            />
            <span className="min-w-0">
              <span className="block text-sm text-ink">{o.label}</span>
              {o.description && <span className="block text-xs text-muted mt-0.5">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
