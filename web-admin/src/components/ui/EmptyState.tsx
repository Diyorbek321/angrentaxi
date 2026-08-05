import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * `positive` — bo'sh bo'lishi SOG'LOM holat bo'lgan ro'yxatlar uchun
   * (masalan: kutilayotgan moderatsiya yo'q). "Buzilgan" degan ma'no bermasin.
   */
  tone?: 'neutral' | 'positive';
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-8' : 'gap-3 py-14',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-ds-md',
          compact ? 'h-11 w-11' : 'h-14 w-14',
          tone === 'positive' ? 'bg-mint-tint text-primary-text' : 'bg-surface-2 text-subtle'
        )}
        aria-hidden="true"
      >
        {icon ?? <Inbox className={compact ? 'h-5 w-5' : 'h-6 w-6'} />}
      </div>
      <div className="max-w-sm">
        <p className={cn('font-semibold', tone === 'positive' ? 'text-primary-text' : 'text-ink')}>
          {title}
        </p>
        {description && <p className="mt-1 text-body leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
