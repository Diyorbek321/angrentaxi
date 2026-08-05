import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** O'ngdagi boshqaruv: yangilash, filtr, asosiy harakat. */
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * Har bir sahifa sarlavhasi shu komponent orqali chiziladi — shunda 19 ta
 * sahifada sarlavha o'lchami, oraliq va chegara bir xil bo'ladi.
 * Sahifada bitta `h1` bo'lishi uchun sarlavha aynan shu yerda chiqadi.
 */
export function PageHeader({ title, description, actions, icon, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4',
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-sm bg-mint-tint text-primary-text"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-h1 leading-tight text-ink">{title}</h1>
          {description && <p className="mt-0.5 text-body text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
