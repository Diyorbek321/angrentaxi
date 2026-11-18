// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** none · sm 12px · md 16px (default) · lg 20px. Use `none` with CardHeader/CardBody. */
  padding?: CardPadding;
  hoverable?: boolean;
  /** Selected row/card: primary edge. */
  selected?: boolean;
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

/** White surface, hairline border, 10px radius, no floating shadow. */
const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'md', hoverable = false, selected = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-surface rounded-ds-md border shadow-card transition-colors',
        selected ? 'border-primary ring-1 ring-primary/25' : 'border-line',
        paddingClasses[padding],
        hoverable && 'hover:border-line-strong cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Structured header: title (15px/600) + description + right-side actions. */
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Draw a divider under the header (for CardBody/table bodies). */
  divider?: boolean;
}

/**
 * Two modes: structured (`title`/`description`/`actions`) with its own
 * padding, or free children (legacy: a flex row with bottom margin).
 */
const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, description, actions, divider = false, className, children, ...props }, ref) => {
    if (title == null && description == null && actions == null) {
      return (
        <div ref={ref} className={cn('flex items-center justify-between gap-3 mb-3', className)} {...props}>
          {children}
        </div>
      );
    }
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start justify-between gap-3 px-4 pt-3.5 pb-3',
          divider && 'border-b border-line',
          className
        )}
        {...props}
      >
        <div className="min-w-0">
          {title != null && <h3 className="text-title text-ink truncate">{title}</h3>}
          {description != null && <div className="text-[13px] text-muted mt-0.5">{description}</div>}
          {children}
        </div>
        {actions != null && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    );
  }
);
CardHeader.displayName = 'CardHeader';

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement>;

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('text-title text-ink', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-[13px] text-muted', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

/** Padded body (16px). `CardContent` is the shadcn-style alias. */
const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-4 pb-4', className)} {...props} />
));
CardBody.displayName = 'CardBody';

const CardContent = CardBody;

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center justify-end gap-2 px-4 py-3 border-t border-line', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardBody, CardContent, CardFooter };
