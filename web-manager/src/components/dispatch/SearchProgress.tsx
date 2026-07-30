'use client';

import { Radar } from 'lucide-react';
import { clsx } from 'clsx';
import { useNow } from './useNow';

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

  const startedAt = new Date(createdAt).getTime();
  const elapsedMs = now == null ? 0 : Math.max(0, now - startedAt);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const windowSec = Math.round(AUTO_MATCH_WINDOW_MS / 1000);
  const ratio = Math.min(1, elapsedMs / AUTO_MATCH_WINDOW_MS);
  const expired = elapsedMs >= AUTO_MATCH_WINDOW_MS;

  // Which offer round the search is roughly in, given the fixed per-offer
  // timeout. Shown as an approximation ("~"), never as a hard fact.
  const offerRound = Math.min(
    Math.floor(AUTO_MATCH_WINDOW_MS / OFFER_TIMEOUT_MS),
    Math.floor(elapsedMs / OFFER_TIMEOUT_MS) + 1
  );

  return (
    <div className={clsx('rounded-lg border border-override/30 bg-override/[0.07] px-3 py-2', className)}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-override-dark dark:text-override-light">
          <Radar size={12} className="animate-pulse" />
          {expired ? 'Qidiruv oynasi tugadi' : `Avtomatik qidiruv — ~${offerRound}-taklif`}
        </span>
        <span className="font-mono text-[11px] text-muted tabular-nums">
          {now == null ? '—' : `${elapsedSec}s / ${windowSec}s`}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-[width] duration-1000 ease-linear',
            expired ? 'bg-danger' : 'bg-override'
          )}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-subtle mt-1.5 leading-snug">
        {expired
          ? 'Tizim haydovchi topa olmadi — Istisnolar boʻlimida hal qilinadi.'
          : 'Har ~15 soniyada keyingi eng yaqin haydovchiga taklif yuboriladi.'}
      </p>
    </div>
  );
}
