'use client';

import { Radar } from 'lucide-react';
import { clsx } from 'clsx';
import { useNow } from './useNow';
import { formatClock, formatDuration } from '@/lib/format';
import { t } from '@/locales';

/**
 * Mirrors the backend's MatchingService.NO_DRIVER_TIMEOUT_MS — how long the
 * automatic search runs before it gives up and the order lands in Exceptions.
 */
export const AUTO_MATCH_WINDOW_MS = 60_000;

/** MatchingService waits this long for each driver to answer an offer. */
const OFFER_TIMEOUT_MS = 15_000;

/**
 * Makes the automatic search visible instead of leaving the operator staring
 * at a static "Searching" badge. It shows elapsed time against the known
 * search window — deliberately not a driver-by-driver count, because the API
 * does not expose which offer the matching service is currently on.
 */
export function SearchProgress({
  createdAt,
  className,
}: {
  createdAt: string;
  className?: string;
}) {
  // Null until mounted — see useNow: Date.now() during render would trip a
  // hydration mismatch.
  const now = useNow(1000);
  const m = t().dispatch.search;

  const startedAt = new Date(createdAt).getTime();
  const elapsedMs = now == null ? 0 : Math.max(0, now - startedAt);
  // Clock format, never raw seconds ("184913s / 60s" read as noise): the
  // live search shows "0:42 / 1:00"; once the window has passed the elapsed
  // time is humanized ("Muddati oʻtgan · 2 kun 3 soat").
  const timeText =
    now == null
      ? '—'
      : elapsedMs >= AUTO_MATCH_WINDOW_MS
      ? m.overdue(formatDuration(elapsedMs))
      : `${formatClock(elapsedMs)} / ${formatClock(AUTO_MATCH_WINDOW_MS)}`;
  const ratio = Math.min(1, elapsedMs / AUTO_MATCH_WINDOW_MS);
  const expired = elapsedMs >= AUTO_MATCH_WINDOW_MS;

  // Which offer round the search is roughly in, given the fixed per-offer
  // timeout. Shown as an approximation ("~"), never as a hard fact.
  const offerRound = Math.min(
    Math.floor(AUTO_MATCH_WINDOW_MS / OFFER_TIMEOUT_MS),
    Math.floor(elapsedMs / OFFER_TIMEOUT_MS) + 1
  );

  // Mint, not amber, deliberately: this is the SYSTEM working (mint = the
  // machine is driving). Amber belongs to manual override alone — if the
  // search wore amber too, the intervention colour would stop meaning
  // anything. Expiry hands over to danger: the algorithm has given up and
  // the order is now an exception.
  return (
    <div
      className={clsx(
        'rounded-ds-xs border px-3 py-2',
        expired ? 'border-danger/40 bg-danger-tint' : 'border-mint/40 bg-mint-tint',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className={clsx(
            'inline-flex items-center gap-1.5 text-[11px] font-semibold',
            expired ? 'text-danger-deep dark:text-danger-light' : 'text-primary-text'
          )}
        >
          <Radar size={12} className={expired ? undefined : 'animate-pulse'} />
          {expired ? m.windowEnded : m.autoSearch(offerRound)}
        </span>
        <span className="num text-[11px] text-muted whitespace-nowrap">{timeText}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-[width] duration-1000 ease-linear',
            expired ? 'bg-danger' : 'bg-mint-deep'
          )}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-subtle mt-1.5 leading-snug">
        {expired
          ? m.expiredNote
          : m.activeNote}
      </p>
    </div>
  );
}
