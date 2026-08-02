'use client';

import { useEffect, useState } from 'react';

/**
 * Ticking wall-clock for "how long has this been open" readouts.
 *
 * Lives here rather than in src/hooks/ — that directory holds the real-time
 * data hooks and is off-limits for this redesign.
 *
 * Returns `null` until after mount on purpose: reading Date.now() during
 * render produces one value on the server and another on the client, which is
 * a hydration mismatch. Callers render a placeholder while it is null.
 */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
}
