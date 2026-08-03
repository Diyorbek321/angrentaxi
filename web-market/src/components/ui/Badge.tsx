import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'info'
  /** Amber — low stock and nothing else. */
  | 'warning'
  /** Red — out of stock, cancelled. Never decorative. */
  | 'danger';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-2 text-muted border border-line',
  primary: 'bg-primary/12 text-primary-700 dark:text-primary-300 border border-primary/30',
  success: 'bg-delivered/12 text-delivered dark:text-delivered-light border border-delivered/30',
  info: 'bg-info/12 text-info dark:text-blue-300 border border-info/30',
  warning: 'bg-warn/12 text-warn-dark dark:text-warn-light border border-warn/30',
  danger: 'bg-danger/12 text-danger border border-danger/30',
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
        className={cn(
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
