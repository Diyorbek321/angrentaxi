import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * `positive` — bo'shlik yaxshi holat degani (masalan yangi buyurtmalar
   * navbati bo'sh). U "buzilgan" yoki "ma'lumot yo'qolgan" kabi o'qilmasligi
   * kerak.
   */
  tone?: 'neutral' | 'positive';
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-8' : 'gap-3 py-14',
        className
      )}
    >
      <div
        aria-hidden
        className={clsx(
          'flex items-center justify-center rounded-ds-md',
          compact ? 'h-11 w-11' : 'h-14 w-14',
          tone === 'positive' ? 'bg-mint-tint text-primary-text' : 'bg-surface-2 text-subtle'
        )}
      >
        {icon ?? <Inbox size={compact ? 20 : 24} />}
      </div>
      <div className="max-w-sm">
        <p className={clsx('text-h3', tone === 'positive' ? 'text-primary-text' : 'text-ink')}>{title}</p>
        {description && <p className="text-body text-muted mt-1 leading-relaxed">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
