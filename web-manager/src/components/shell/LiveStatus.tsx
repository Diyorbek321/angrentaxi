// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { cn } from '../ui/cn';
import { RefreshButton } from '../ui/RefreshButton';
import { formatTime } from '@/lib/format';

export type LiveState = 'live' | 'connecting' | 'reconnecting' | 'stale' | 'offline';

export interface LiveStatusProps {
  state: LiveState;
  /** Time of the last good data — "10:42 holatiga". */
  updatedAt?: number | Date | null;
  /** Hide the text below `sm` (dot only). */
  compact?: boolean;
  /**
   * Manual refresh (↻ after the pill). Pass one callback that reloads the
   * shell AND the current page so the topbar button refreshes what you see.
   */
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
  className?: string;
}

const LABEL: Record<LiveState, string> = {
  live: 'Jonli',
  connecting: 'Ulanmoqda',
  reconnecting: 'Qayta ulanmoqda',
  stale: 'Eskirgan',
  offline: 'Aloqa yoʻq',
};

/**
 * The ONE freshness readout per screen (topbar live slot). Calm when live
 * (small mint dot), neutral while reconnecting, red when the data on screen
 * is stale — with the time it is "as of", so a frozen panel never looks live.
 */
export function LiveStatus({ onRefresh, isRefreshing = false, className, ...pill }: LiveStatusProps) {
  if (!onRefresh) return <StatusPill {...pill} className={className} />;
  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <StatusPill {...pill} />
      <RefreshButton onRefresh={onRefresh} isRefreshing={isRefreshing} />
    </div>
  );
}

function StatusPill({
  state,
  updatedAt,
  compact = true,
  className,
}: Pick<LiveStatusProps, 'state' | 'updatedAt' | 'compact' | 'className'>) {
  const at = updatedAt != null ? formatTime(updatedAt) : null;
  const bad = state === 'stale' || state === 'offline';
  const pending = state === 'connecting' || state === 'reconnecting';
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 h-7 px-2 rounded-ds-sm text-xs whitespace-nowrap',
        bad ? 'bg-danger-tint text-danger-dark dark:text-danger-light' : 'text-muted',
        className
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        {state === 'live' && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-mint-deep opacity-50 motion-safe:animate-ping [animation-duration:2.5s]" />
        )}
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            state === 'live' && 'bg-mint-deep',
            pending && 'bg-subtle motion-safe:animate-pulse',
            bad && 'bg-danger'
          )}
        />
      </span>
      <span className={cn('font-medium', state === 'live' ? 'text-ink' : undefined, compact && 'hidden sm:inline')}>
        {LABEL[state]}
      </span>
      {at && (
        <span className={cn('num', compact && 'hidden md:inline', !bad && 'text-subtle')}>· {at} holatiga</span>
      )}
    </div>
  );
}

/** Maps a socket status to a LiveState (`hadConnection` = was ever live). */
export function liveStateFromSocket(
  status: 'connecting' | 'connected' | 'disconnected' | 'error',
  hadConnection: boolean
): LiveState {
  if (status === 'connected') return 'live';
  if (status === 'connecting') return hadConnection ? 'reconnecting' : 'connecting';
  return hadConnection ? 'stale' : 'offline';
}
