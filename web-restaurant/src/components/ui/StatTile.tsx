import { ReactNode } from 'react';
import { clsx } from 'clsx';

export type StatTone = 'neutral' | 'mint' | 'info' | 'override' | 'danger' | 'muted';

const toneClasses: Record<StatTone, { dot: string; value: string; icon: string }> = {
  // Yorug' fonda ko'rinishi shart bo'lgan yashil — `mint-deep` (3.37:1),
  // `mint` emas (2.12:1). DESIGN-TOKENS 2.1.
  neutral: { dot: 'bg-subtle', value: 'text-ink', icon: 'bg-surface-2 text-muted' },
  mint: { dot: 'bg-mint-deep', value: 'text-primary-text', icon: 'bg-mint-tint text-primary-text' },
  info: {
    dot: 'bg-info',
    value: 'text-info-deep dark:text-info-light',
    icon: 'bg-info-tint text-info-deep dark:text-info-light',
  },
  override: {
    dot: 'bg-override',
    value: 'text-override-dark dark:text-override-light',
    icon: 'bg-override-tint text-override-dark dark:text-override-light',
  },
  danger: {
    dot: 'bg-danger',
    value: 'text-danger-deep dark:text-danger-light',
    icon: 'bg-danger-tint text-danger-deep dark:text-danger-light',
  },
  muted: { dot: 'bg-line-strong', value: 'text-muted', icon: 'bg-surface-2 text-muted' },
};

export interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: StatTone;
  icon?: ReactNode;
  hint?: string;
  /** Real vaqtda o'zgaradigan hisoblagichlar uchun nuqta puls qiladi. */
  live?: boolean;
  className?: string;
}

export function StatTile({
  label,
  value,
  unit,
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
        'bg-surface border border-line rounded-ds-md shadow-card p-4 flex items-start gap-3 min-w-0',
        className
      )}
    >
      {icon ? (
        <span className={clsx('shrink-0 h-10 w-10 rounded-ds-sm flex items-center justify-center', t.icon)} aria-hidden>
          {icon}
        </span>
      ) : (
        <span className="relative flex h-2.5 w-2.5 shrink-0 mt-2" aria-hidden>
          {live && (
            <span className={clsx('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', t.dot)} />
          )}
          <span className={clsx('relative inline-flex h-2.5 w-2.5 rounded-full', t.dot)} />
        </span>
      )}
      <div className="min-w-0">
        <p className={clsx('font-mono font-extrabold leading-none tabular-nums text-[26px]', t.value)}>
          {value}
          {unit && <span className="text-caption font-bold text-muted ml-1">{unit}</span>}
        </p>
        <p className="text-caption font-semibold text-muted mt-1.5 truncate">{label}</p>
        {hint && <p className="text-micro text-subtle mt-0.5 truncate">{hint}</p>}
      </div>
    </div>
  );
}
