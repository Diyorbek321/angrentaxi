// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from './cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: boolean;
  /** "Some selected" state for a select-all header checkbox. */
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: InputHTMLAttributes<HTMLInputElement>['onChange'];
  label?: ReactNode;
  description?: ReactNode;
}

/** 16px native checkbox (keeps forms + react-hook-form working), custom look. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, indeterminate = false, onCheckedChange, onChange, label, description, className, id, disabled, ...props }, ref) => {
    const auto = useId();
    const boxId = id ?? auto;
    const inner = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
      if (inner.current) inner.current.indeterminate = indeterminate;
    }, [indeterminate]);

    const box = (
      <span className="relative inline-flex h-4 w-4 shrink-0">
        <input
          ref={(node) => {
            inner.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          id={boxId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => {
            onChange?.(e);
            onCheckedChange?.(e.target.checked);
          }}
          className={cn(
            'peer appearance-none h-4 w-4 rounded-[4px] border border-line-strong bg-surface cursor-pointer transition-colors',
            'checked:bg-primary checked:border-primary indeterminate:bg-primary indeterminate:border-primary',
            'dark:checked:bg-primary-on-dark dark:checked:border-primary-on-dark',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        <Check
          size={12}
          strokeWidth={3}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0"
        />
        <Minus
          size={12}
          strokeWidth={3}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto text-white opacity-0 peer-indeterminate:opacity-100"
        />
      </span>
    );

    if (!label) return box;
    return (
      <label htmlFor={boxId} className={cn('inline-flex items-start gap-2 cursor-pointer', disabled && 'cursor-not-allowed opacity-60')}>
        <span className="mt-0.5">{box}</span>
        <span className="min-w-0">
          <span className="block text-sm text-ink">{label}</span>
          {description && <span className="block text-xs text-muted mt-0.5">{description}</span>}
        </span>
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';
