import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * `positive` is for empty states that mean things are going well — nothing
   * out of stock and no unanswered orders is the healthy state, and must read
   * as "hammasi joyida", not as missing data.
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
          'flex items-center justify-center rounded-2xl',
          compact ? 'h-11 w-11' : 'h-14 w-14',
          tone === 'positive'
            ? 'bg-primary/12 text-primary-600 dark:text-primary-300'
            : 'bg-surface-2 text-subtle'
        )}
      >
        {icon ?? <Inbox size={compact ? 20 : 24} />}
      </div>
      <div className="max-w-sm">
        <p
          className={cn(
            'font-semibold',
            tone === 'positive' ? 'text-primary-700 dark:text-primary-300' : 'text-ink'
          )}
        >
          {title}
        </p>
        {description && <p className="text-sm text-muted mt-1 leading-relaxed">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
