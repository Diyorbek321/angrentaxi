import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  /** Tanlangan qator/karta — chegara INTERAKTIV qatlam rangida. */
  selected?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'md', hoverable = false, selected = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'bg-surface rounded-ds-md border shadow-card transition-colors duration-fast ease-standard',
        selected ? 'border-primary ring-1 ring-primary/30' : 'border-line',
        paddingClasses[padding],
        hoverable && 'hover:border-line-strong hover:bg-surface-2/50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';

export type CardHeaderProps = HTMLAttributes<HTMLDivElement>;

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={clsx('flex items-center justify-between gap-3 mb-4', className)} {...props}>
    {children}
  </div>
));
CardHeader.displayName = 'CardHeader';

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement>;

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(({ className, children, ...props }, ref) => (
  <h2 ref={ref} className={clsx('text-h3 text-ink', className)} {...props}>
    {children}
  </h2>
));
CardTitle.displayName = 'CardTitle';

export { Card, CardHeader, CardTitle };
