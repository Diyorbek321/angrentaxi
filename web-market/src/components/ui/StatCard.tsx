// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import type { ReactNode } from 'react';
import { cn } from './cn';
import { Skeleton } from './Skeleton';
import { kitT } from '@/lib/i18n/kit-messages';

export type StatTone = 'neutral' | 'mint' | 'info' | 'violet' | 'override' | 'danger' | 'muted';
/** Legacy colour names (web-admin) → canonical tones. */
export type StatVariant = StatTone | 'yellow' | 'blue' | 'green' | 'purple';

const ALIAS: Record<StatVariant, StatTone> = {
  neutral: 'neutral',
  mint: 'mint',
  info: 'info',
  violet: 'violet',
  override: 'override',
  danger: 'danger',
  muted: 'muted',
  yellow: 'override',
  blue: 'info',
  green: 'mint',
  purple: 'violet',
};

/**
 * Tone shows as a small status dot only. The value stays ink — greys carry
 * hierarchy, colour is for status: only `danger` and `override` (a human
 * stepped in) tint the number itself.
 */
const toneDot: Record<StatTone, string> = {
  neutral: 'bg-subtle',
  mint: 'bg-mint-deep',
  info: 'bg-info',
  violet: 'bg-violet',
  override: 'bg-override',
  danger: 'bg-danger',
  muted: 'bg-line-strong',
};

const toneValue: Record<StatTone, string> = {
  neutral: 'text-ink',
  mint: 'text-ink',
  info: 'text-ink',
  violet: 'text-ink',
  override: 'text-override-dark dark:text-override-light',
  danger: 'text-danger-dark dark:text-danger-light',
  muted: 'text-muted',
};

export interface StatDelta {
  /** Percent change vs the REAL previous period. Never invent one. */
  value: number;
  /** e.g. "o'tgan haftaga nisbatan". */
  label?: string;
  /** Default true: up = good (mint), down = bad (danger). */
  positiveIsGood?: boolean;
}

export interface StatCardProps {
  /** Metric name (alias: `title`). */
  label?: string;
  title?: string;
  value: ReactNode;
  /** Small muted unit after the value ("so'm", "daq"). */
  unit?: string;
  /** Footnote under the value (alias: `subtitle`). */
  hint?: ReactNode;
  subtitle?: ReactNode;
  tone?: StatVariant;
  /** Alias of `tone` (web-admin). */
  variant?: StatVariant;
  /** Small muted glyph next to the label — no coloured tile. */
  icon?: ReactNode;
  /** Change vs the previous period (alias: `trend`). Omit when there is no real baseline. */
  delta?: StatDelta;
  trend?: StatDelta;
  /**
   * Real series only. Drawn when it has ≥ 7 points; shorter series are
   * ignored (a 2-point "sparkline" is a fake trend).
   */
  sparkline?: number[];
  /** Pulses the tone dot — counters that move in real time. */
  live?: boolean;
  isLoading?: boolean;
  /** `sm` = dense strip (control room), `md` = dashboard KPI. */
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

const MIN_SPARK_POINTS = 7;

function Sparkline({ points }: { points: number[] }) {
  const w = 96;
  const h = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${(i * step).toFixed(1)},${(h - ((p - min) / span) * (h - 2) - 1).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="text-subtle shrink-0">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function Delta({ delta }: { delta: StatDelta }) {
  const up = delta.value > 0;
  const flat = delta.value === 0;
  const good = flat ? null : up === (delta.positiveIsGood ?? true);
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span
        className={cn(
          'num font-semibold',
          good === null && 'text-muted',
          good === true && 'text-primary-text',
          good === false && 'text-danger-dark dark:text-danger-light'
        )}
      >
        {flat ? '0%' : `${up ? '▲' : '▼'} ${Math.abs(delta.value).toFixed(Math.abs(delta.value) < 10 ? 1 : 0)}%`}
        <span className="sr-only"> {flat ? kitT().statCard.flat : up ? kitT().statCard.up : kitT().statCard.down}</span>
      </span>
      {delta.label && <span className="text-subtle">{delta.label}</span>}
    </span>
  );
}

/**
 * KPI card: label → value (24px/600 `.num`) → delta (only with a real
 * previous period) → hint. No coloured border, no icon tile, no fake spark.
 */
export function StatCard({
  label,
  title,
  value,
  unit,
  hint,
  subtitle,
  tone,
  variant,
  icon,
  delta,
  trend,
  sparkline,
  live = false,
  isLoading = false,
  size = 'md',
  onClick,
  className,
}: StatCardProps) {
  const t = ALIAS[tone ?? variant ?? 'neutral'];
  const name = label ?? title ?? '';
  const change = delta ?? trend;
  const note = hint ?? subtitle;
  const spark = sparkline && sparkline.length >= MIN_SPARK_POINTS ? sparkline : null;
  const showDot = t !== 'neutral' || live;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'min-w-0 text-left bg-surface border border-line rounded-ds-md',
        size === 'sm' ? 'px-3.5 py-2.5' : 'p-4',
        onClick &&
          'hover:border-line-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        className
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {icon && <span className="shrink-0 text-subtle [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>}
        <p className="text-[13px] text-muted truncate">{name}</p>
        {showDot && (
          <span className="relative ml-auto flex h-2 w-2 shrink-0" aria-hidden>
            {live && (
              <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping', toneDot[t])} />
            )}
            <span className={cn('relative inline-flex h-2 w-2 rounded-full', toneDot[t])} />
          </span>
        )}
      </div>

      <div className={cn('flex items-end justify-between gap-3', size === 'sm' ? 'mt-1' : 'mt-2')}>
        {isLoading ? (
          <Skeleton className={size === 'sm' ? 'h-5 w-16' : 'h-7 w-28'} />
        ) : (
          <p
            className={cn(
              'num font-semibold leading-none tracking-tight truncate',
              size === 'sm' ? 'text-xl' : 'text-2xl',
              toneValue[t]
            )}
          >
            {value}
            {unit && <span className="ml-1 text-[13px] font-medium text-muted">{unit}</span>}
          </p>
        )}
        {spark && !isLoading && <Sparkline points={spark} />}
      </div>

      {!isLoading && change && (
        <div className="mt-2">
          <Delta delta={change} />
        </div>
      )}
      {!isLoading && note && (
        <p className={cn('text-xs text-subtle truncate', change ? 'mt-1' : size === 'sm' ? 'mt-1' : 'mt-2')}>
          {note}
        </p>
      )}
    </Tag>
  );
}
