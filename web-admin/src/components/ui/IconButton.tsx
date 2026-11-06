// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required — an icon has no text for screen readers. */
  'aria-label': string;
  icon?: ReactNode;
  variant?: 'ghost' | 'secondary' | 'danger-ghost';
  size?: 'sm' | 'md';
  /** Small count/dot in the top-right corner. */
  badge?: number | boolean;
}

/** 32px square icon button (28px `sm`). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, children, variant = 'ghost', size = 'md', badge, className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      title={props.title ?? props['aria-label']}
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 rounded-ds-sm transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 disabled:pointer-events-none',
        '[&_svg]:h-4 [&_svg]:w-4',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        variant === 'ghost' && 'text-muted hover:text-ink hover:bg-surface-2',
        variant === 'secondary' && 'border border-line bg-surface text-muted hover:text-ink hover:bg-surface-2',
        variant === 'danger-ghost' && 'text-muted hover:text-danger-dark dark:hover:text-danger-light hover:bg-danger-tint',
        className
      )}
      {...props}
    >
      {icon ?? children}
      {badge === true && (
        <span aria-hidden className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-danger ring-2 ring-surface" />
      )}
      {typeof badge === 'number' && badge > 0 && (
        <span
          aria-hidden
          className="num absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[10px] font-semibold leading-4 text-center ring-2 ring-surface"
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
);
IconButton.displayName = 'IconButton';
