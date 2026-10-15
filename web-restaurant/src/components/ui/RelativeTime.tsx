// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { useEffect, useState } from 'react';
import { cn } from './cn';
import { formatDateTime, formatRelative } from '@/lib/format';

export interface RelativeTimeProps {
  value: string | number | Date | null | undefined;
  /** Re-render interval, ms (default 30s). 0 = static. */
  refreshMs?: number;
  className?: string;
}

/**
 * "3 daqiqa oldin" with the exact time in the tooltip and <time dateTime>.
 * Renders the absolute time on the server, relative after mount (no mismatch).
 */
export function RelativeTime({ value, refreshMs = 30_000, className }: RelativeTimeProps) {
  const [mounted, setMounted] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    setMounted(true);
    if (!refreshMs) return;
    const t = setInterval(() => tick((n) => n + 1), refreshMs);
    return () => clearInterval(t);
  }, [refreshMs]);

  if (value == null || value === '') return <span className={cn('text-subtle', className)}>—</span>;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return <span className={cn('text-subtle', className)}>—</span>;
  const absolute = formatDateTime(d, { withYear: true });
  return (
    <time dateTime={d.toISOString()} title={absolute} className={cn('whitespace-nowrap', className)}>
      {mounted ? formatRelative(d) : absolute}
    </time>
  );
}
