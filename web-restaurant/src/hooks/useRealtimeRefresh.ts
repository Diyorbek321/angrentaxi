'use client';

import { useEffect, useRef } from 'react';
import { subscribeVendorRefresh } from '@/lib/realtime';

/**
 * Yangi buyurtma, kuryer topilmadi, naqd to'lov kabi hodisada [refresh] ni
 * darhol chaqiradi. Polling o'rnini bosmaydi — uning ustiga qo'shiladi.
 */
export function useRealtimeRefresh(refresh: () => unknown, enabled = true): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    return subscribeVendorRefresh(() => void refreshRef.current());
  }, [enabled]);
}
