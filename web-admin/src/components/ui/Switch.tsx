// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import type { ReactNode } from 'react';
import { cn } from './cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** `danger` = turning it on is risky (e.g. maintenance mode). */
  tone?: 'primary' | 'danger';
  /** `lg` = 44×26 thumb-friendly touch variant (kitchen / tablet). */
  size?: 'sm' | 'md' | 'lg';
  label?: ReactNode;
  'aria-label'?: string;
  id?: string;
  className?: string;
}

/** role="switch" toggle; 32×18 (28×16 `sm`, 44×26 `lg` touch). */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  tone = 'primary',
  size = 'md',
  label,
  id,
  className,
  ...aria
}: SwitchProps) {
  const control = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={aria['aria-label']}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-4 w-7' : size === 'lg' ? 'h-[26px] w-11' : 'h-[18px] w-8',
        checked
          ? tone === 'danger'
            ? 'bg-danger border-danger'
            : 'bg-primary border-primary dark:bg-primary-on-dark dark:border-primary-on-dark'
          : 'bg-surface-3 border-line-strong',
        !label && className
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform',
          size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-[22px] w-[22px]' : 'h-3.5 w-3.5',
          checked
            ? size === 'sm'
              ? 'translate-x-3'
              : size === 'lg'
                ? 'translate-x-[19px]'
                : 'translate-x-[15px]'
            : 'translate-x-px'
        )}
      />
    </button>
  );
  if (!label) return control;
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 text-sm text-ink cursor-pointer',
        size === 'lg' && 'min-h-touch gap-3 text-base',
        className
      )}
    >
      {control}
      <span>{label}</span>
    </label>
  );
}
