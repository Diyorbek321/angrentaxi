import { ReactNode } from 'react';
import { clsx } from 'clsx';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned controls: refresh, filters, primary action. */
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, icon, className }: PageHeaderProps) {
  return (
    <div
      className={clsx(
        'flex flex-wrap items-start justify-between gap-3 pb-4 mb-5 border-b border-line',
        className
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <span className="h-9 w-9 shrink-0 rounded-xl bg-primary/12 text-primary-600 dark:text-primary-300 flex items-center justify-center">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-ink leading-tight">{title}</h1>
          {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
