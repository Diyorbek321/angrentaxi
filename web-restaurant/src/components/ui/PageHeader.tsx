import { ReactNode } from 'react';
import { clsx } from 'clsx';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** O'ngdagi boshqaruvlar: yangilash, filtr, asosiy harakat. */
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * Har bir sahifada bitta va bir xil sarlavha bloki. `<h1>` shu yerda —
 * sahifada boshqa h1 bo'lmasligi kerak.
 */
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
          <span
            aria-hidden
            className="h-10 w-10 shrink-0 rounded-ds-sm bg-mint-tint text-primary-text flex items-center justify-center"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-h1 text-ink">{title}</h1>
          {description && <p className="text-body text-muted mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
