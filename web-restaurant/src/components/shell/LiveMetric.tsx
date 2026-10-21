// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '../ui/cn';
import { formatNumber } from '@/lib/format';
import { kitT } from '@/lib/i18n/kit-messages';

export interface LiveMetricProps {
  icon?: ReactNode;
  value: number | null | undefined;
  label: string;
  loading?: boolean;
  /**
   * `danger` only when the number demands action now (exceptions > 0).
   * `attention` = calm info tint for "work is waiting" (new orders > 0) —
   * never amber (amber = manual override only).
   */
  tone?: 'neutral' | 'attention' | 'danger';
  href?: string;
  className?: string;
}

/**
 * Compact topbar readout ("12 aktiv buyurtma"). Neutral by default — colour
 * only when it means "act now".
 */
export function LiveMetric({ icon, value, label, loading = false, tone = 'neutral', href, className }: LiveMetricProps) {
  const danger = tone === 'danger';
  const attention = tone === 'attention';
  const toneText = danger
    ? 'text-danger-dark dark:text-danger-light'
    : attention
      ? 'text-info-dark dark:text-info-light'
      : undefined;
  const body = (
    <>
      {icon && (
        <span
          className={cn('shrink-0 [&_svg]:h-4 [&_svg]:w-4', danger ? 'text-danger' : attention ? 'text-info' : 'text-subtle')}
        >
          {icon}
        </span>
      )}
      {loading ? (
        <span aria-hidden className="skeleton h-3 w-5 rounded-ds-xs" />
      ) : (
        <span className={cn('num text-[13px] font-semibold', toneText ?? 'text-ink')}>{formatNumber(value ?? null)}</span>
      )}
      <span className={cn('hidden xl:inline text-xs', toneText ?? 'text-muted')}>{label}</span>
    </>
  );
  const cls = cn(
    'inline-flex items-center gap-1.5 h-7 px-2 rounded-ds-sm whitespace-nowrap transition-colors',
    danger ? 'bg-danger-tint' : attention ? 'bg-info-tint' : href ? 'hover:bg-surface-2' : undefined,
    href && 'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
    className
  );
  const a11y = `${label}: ${loading ? kitT().live.metricLoading : formatNumber(value ?? null)}`;
  return href ? (
    <Link href={href} title={label} aria-label={a11y} className={cls}>
      {body}
    </Link>
  ) : (
    <div title={label} aria-label={a11y} role="group" className={cls}>
      {body}
    </div>
  );
}

/** Thin vertical divider between live-slot groups. */
export function LiveDivider() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-line shrink-0" />;
}
