import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatTone = 'neutral' | 'mint' | 'info' | 'warn' | 'danger';

const toneClasses: Record<StatTone, { icon: string; value: string }> = {
  neutral: { icon: 'bg-surface-2 text-muted', value: 'text-ink' },
  mint: {
    icon: 'bg-primary/12 text-primary-600 dark:text-primary-300',
    value: 'text-primary-700 dark:text-primary-300',
  },
  info: { icon: 'bg-info/12 text-info dark:text-blue-300', value: 'text-info dark:text-blue-300' },
  // Amber and red are attention states only — a stat wears them when the
  // vendor has something to fix, never for decoration.
  warn: {
    icon: 'bg-warn/12 text-warn-dark dark:text-warn-light',
    value: 'text-warn-dark dark:text-warn-light',
  },
  danger: { icon: 'bg-danger/12 text-danger', value: 'text-danger' },
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  hint?: string;
  /** Pulses the icon — for counters that move while the vendor watches. */
  live?: boolean;
  /** Drops the value a size, so long readouts like money still fit on one line. */
  compactValue?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'neutral',
  hint,
  live = false,
  compactValue = false,
  className,
}: StatCardProps) {
  const t = toneClasses[tone];

  return (
    <div className={cn('surface-card p-4 flex items-start gap-3.5 min-w-0', className)}>
      {icon && (
        <span
          className={cn(
            'relative h-10 w-10 shrink-0 rounded-xl flex items-center justify-center',
            t.icon
          )}
        >
          {live && (
            <span className="absolute inset-0 rounded-xl animate-pulse-mint" aria-hidden />
          )}
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted truncate">{label}</p>
        <p
          className={cn(
            'font-bold font-mono tabular-nums leading-tight mt-1',
            compactValue ? 'text-lg' : 'text-2xl',
            t.value
          )}
        >
          {value}
        </p>
        {hint && <p className="text-[11px] text-subtle mt-1 truncate">{hint}</p>}
      </div>
    </div>
  );
}
