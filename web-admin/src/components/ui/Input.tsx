// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { Field, controlBase, controlBorder, describedBy } from './Field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  /** Prefix slot (icon or text). Alias: `leftIcon`. */
  leftElement?: ReactNode;
  leftIcon?: ReactNode;
  /** Suffix slot (icon, unit, button). Alias: `rightIcon`. */
  rightElement?: ReactNode;
  rightIcon?: ReactNode;
  /** Monospace — ONLY for ids, plates, SKUs, codes. Numbers/money stay sans (`.num`). */
  mono?: boolean;
  /** sm 28px · md 32px (default) · lg 40px. */
  size?: 'sm' | 'md' | 'lg';
  /** Classes for the outer wrapper. */
  wrapperClassName?: string;
}

const heights = { sm: 'h-7 text-[13px]', md: 'h-8', lg: 'h-10' } as const;

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftElement,
      leftIcon,
      rightElement,
      rightIcon,
      mono = false,
      size = 'md',
      wrapperClassName,
      className,
      id,
      required,
      type,
      ...props
    },
    ref
  ) => {
    const auto = useId();
    const inputId = id ?? auto;
    const left = leftElement ?? leftIcon;
    const right = rightElement ?? rightIcon;
    return (
      <Field id={inputId} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
        <div className="relative flex items-center">
          {left && (
            <div className="absolute left-2.5 text-subtle pointer-events-none flex items-center [&_svg]:h-4 [&_svg]:w-4">
              {left}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(inputId, error, hint)}
            className={cn(
              controlBase,
              controlBorder(!!error),
              heights[size],
              mono ? 'font-mono' : type === 'number' && 'num',
              left ? 'pl-8' : 'pl-2.5',
              right ? 'pr-8' : 'pr-2.5',
              className
            )}
            {...props}
          />
          {right && (
            <div className="absolute right-2.5 text-subtle flex items-center [&_svg]:h-4 [&_svg]:w-4">{right}</div>
          )}
        </div>
      </Field>
    );
  }
);

Input.displayName = 'Input';

export { Input };
