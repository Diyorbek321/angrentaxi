'use client';

import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name — required, since the track carries no text of its own. */
  label: string;
  /** Visible text next to the track. */
  children?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

// Knob travel = track width - knob - (2 x inset), so the two sizes need
// their own numbers rather than one shared translate.
const sizes = {
  sm: { track: 'h-5 w-9', knob: 'h-3 w-3', on: 'translate-x-4' },
  md: { track: 'h-6 w-11', knob: 'h-4 w-4', on: 'translate-x-5' },
} as const;

export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  children,
  size = 'md',
  className,
}: SwitchProps) {
  const s = sizes[size];

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2.5',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative shrink-0 rounded-full border transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          s.track,
          checked ? 'bg-primary border-primary' : 'bg-surface-3 border-line-strong',
          disabled && 'cursor-not-allowed'
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 left-1 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform',
            s.knob,
            checked ? s.on : 'translate-x-0'
          )}
        />
      </button>
      {children && <span className="text-sm text-ink select-none">{children}</span>}
    </label>
  );
}
