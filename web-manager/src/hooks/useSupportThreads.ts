'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getSupportThreads, SupportThreadListItem } from '@/lib/api';
import { subscribeToSocket, SOCKET_EVENTS } from '@/lib/socket';

export interface UseSupportThreadsReturn {
  threads: SupportThreadListItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSupportThreads(): UseSupportThreadsReturn {
  const [threads, setThreads] = useState<SupportThreadListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchThreads = useCallback(async () => {
    try {
      setError(null);
      const data = await getSupportThreads();
      if (mountedRef.current) {
        setThreads(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError('Failed to load support threads');
        console.error('Error fetching support threads:', err);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchThreads();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchThreads]);

  useEffect(() => {
    // Payload shape differs from the joined list-item shape (no userName/
    // userPhone/unreadCount) — simplest correct approach is a full refetch
    // rather than a partial client-side merge.
    const handleThreadUpdated = () => {
      if (!mountedRef.current) return;
      fetchThreads();
    };

    // Deferred: the socket needs a token fetched from our own API before it exists.
    return subscribeToSocket((socket) => {
      socket.on(SOCKET_EVENTS.SUPPORT_THREAD_UPDATED, handleThreadUpdated);

      return () => {
        socket.off(SOCKET_EVENTS.SUPPORT_THREAD_UPDATED, handleThreadUpdated);
      };
    });
  }, [fetchThreads]);

  return { threads, isLoading, error, refetch: fetchThreads };
}
