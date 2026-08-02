import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'mint-soft'
  /** Manual intervention marker — amber, and only ever that. */
  | 'override'
  /** Legacy alias kept so existing call sites keep compiling. */
  | 'orange';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-2 text-muted border border-line',
  primary: 'bg-primary/12 text-primary-dark dark:text-primary border border-primary/30',
  success: 'bg-primary-700/10 text-primary-700 dark:text-primary-300 border border-primary-700/25',
  warning: 'bg-override/12 text-override-dark dark:text-override-light border border-override/30',
  danger: 'bg-danger/12 text-danger border border-danger/30',
  info: 'bg-info/12 text-info dark:text-blue-300 border border-info/30',
  'mint-soft': 'bg-primary/8 text-primary-600 dark:text-primary-300 border border-primary/20',
  override: 'bg-override/15 text-override-dark dark:text-override-light border border-override/40',
  orange: 'bg-override/12 text-override-dark dark:text-override-light border border-override/30',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  /** Leading dot — reads as a live status light. */
  dot?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', dot = false, className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap',
          variantClasses[variant],
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
          className
        )}
        {...props}
      >
        {dot && <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
