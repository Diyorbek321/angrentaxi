import { HTMLAttributes, ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Removes the inner padding, for cards that host a full-bleed table. */
  flush?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ flush = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('surface-card', flush ? 'overflow-hidden' : 'p-4', className)}
      {...props}
    >
      {children}
    </div>
  )
);

Card.displayName = 'Card';

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Right-aligned controls — filters, "hammasi" links, view switches. */
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, icon, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-3.5', className)}>
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <span className="text-muted shrink-0 mt-0.5">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export { Card };
