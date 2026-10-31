// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * Canonical tones: neutral · success · info · warning (= override, amber —
 * ONLY for manual human intervention) · danger · muted-danger · violet · searching.
 * `muted-danger` = low-emphasis red text on a neutral fill — a terminal
 * negative state (cancelled order) that must not shout next to live alerts.
 * Every other name is a legacy alias kept so all four panels compile.
 */
export type BadgeVariant =
  | 'neutral'
  | 'success'
  | 'info'
  | 'warning'
  | 'override'
  | 'danger'
  | 'muted-danger'
  | 'violet'
  | 'searching'
  // legacy aliases
  | 'default'
  | 'secondary'
  | 'outline'
  | 'primary'
  | 'mint'
  | 'mint-soft'
  | 'destructive'
  | 'orange';

type Tone = 'neutral' | 'success' | 'info' | 'warning' | 'danger' | 'muted-danger' | 'violet' | 'searching';

const ALIAS: Record<BadgeVariant, Tone> = {
  neutral: 'neutral',
  success: 'success',
  info: 'info',
  warning: 'warning',
  override: 'warning',
  danger: 'danger',
  'muted-danger': 'muted-danger',
  violet: 'violet',
  searching: 'searching',
  default: 'neutral',
  secondary: 'neutral',
  outline: 'neutral',
  primary: 'success',
  mint: 'success',
  'mint-soft': 'success',
  destructive: 'danger',
  orange: 'warning',
};

// Tinted fill + deep text (AA in both themes); hue never the only signal.
const toneClasses: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  success: 'bg-mint-tint text-primary-text border-mint/30',
  info: 'bg-info-tint text-info-dark dark:text-info-light border-info/25',
  warning: 'bg-override-tint text-override-dark dark:text-override-light border-override/35',
  danger: 'bg-danger-tint text-danger-dark dark:text-danger-light border-danger/30',
  'muted-danger': 'bg-surface-2 text-danger-dark/80 dark:text-danger-light/80 border-line',
  violet: 'bg-violet-tint text-violet-dark dark:text-violet-light border-violet/25',
  searching: 'bg-mint-tint text-primary-text border-mint/40',
};

const dotClasses: Record<Tone, string> = {
  neutral: 'bg-subtle',
  success: 'bg-mint-deep',
  info: 'bg-info',
  warning: 'bg-override',
  danger: 'bg-danger',
  'muted-danger': 'bg-danger/50',
  violet: 'bg-violet',
  searching: 'bg-mint-deep animate-pulse',
};

const sizeClasses = {
  sm: 'h-[18px] px-1.5 text-[11px] gap-1',
  md: 'h-5 px-1.5 text-xs gap-1',
  lg: 'h-6 px-2 text-[13px] gap-1.5',
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  /** Leading status dot. */
  dot?: boolean;
  /** Leading icon (replaces the dot). */
  icon?: ReactNode;
}

/** 20px status label, 12px text, 6px radius — not a pill. */
const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'neutral', size = 'md', dot = false, icon, className, children, ...props }, ref) => {
    const tone = ALIAS[variant] ?? 'neutral';
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-ds-xs border whitespace-nowrap leading-none align-middle',
          '[&_svg]:h-3 [&_svg]:w-3 [&_svg]:shrink-0',
          toneClasses[tone],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {icon ? (
          <span aria-hidden className="inline-flex">{icon}</span>
        ) : dot ? (
          <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotClasses[tone])} />
        ) : null}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

/** Alias: status pills read as `<StatusBadge variant="success">Faol</StatusBadge>`. */
const StatusBadge = Badge;

export { Badge, StatusBadge };
