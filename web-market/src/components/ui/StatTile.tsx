import { ReactNode } from 'react';
import { clsx } from 'clsx';

export type StatTone = 'neutral' | 'mint' | 'info' | 'override' | 'danger' | 'muted';

const toneClasses: Record<StatTone, { dot: string; value: string }> = {
  neutral: { dot: 'bg-subtle', value: 'text-ink' },
  mint: { dot: 'bg-mint-deep', value: 'text-primary-text' },
  info: { dot: 'bg-info', value: 'text-info dark:text-blue-300' },
  override: { dot: 'bg-override', value: 'text-override-dark dark:text-override-light' },
  danger: { dot: 'bg-danger', value: 'text-danger' },
  muted: { dot: 'bg-line-strong', value: 'text-muted' },
};

export interface StatTileProps {
  label: string;
  value: ReactNode;
  tone?: StatTone;
  icon?: ReactNode;
  hint?: string;
  /** Pulses the dot — used for counters that move in real time. */
  live?: boolean;
  className?: string;
}

export function StatTile({
  label,
  value,
  tone = 'neutral',
  icon,
  hint,
  live = false,
  className,
}: StatTileProps) {
  const t = toneClasses[tone];
  return (
    <div
      className={clsx(
        'bg-surface border border-line rounded-xl px-3.5 py-2.5 flex items-center gap-3 min-w-0',
        className
      )}
    >
      {icon ? (
        <span className="shrink-0 text-muted">{icon}</span>
      ) : (
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {live && (
            <span className={clsx('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', t.dot)} />
          )}
          <span className={clsx('relative inline-flex h-2.5 w-2.5 rounded-full', t.dot)} />
        </span>
      )}
      <div className="min-w-0">
        <p className={clsx('text-xl font-bold font-mono leading-none tabular-nums', t.value)}>
          {value}
        </p>
        <p className="text-xs text-muted mt-1 truncate">{label}</p>
        {hint && <p className="text-[11px] text-subtle truncate">{hint}</p>}
      </div>
    </div>
  );
}
