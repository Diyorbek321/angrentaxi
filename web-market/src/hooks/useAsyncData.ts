'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/utils';

export interface AsyncData<T> {
  data: T | null;
  /** True only for the very first load, so a refresh never blanks the page. */
  isLoading: boolean;
  /** True while a background refresh is in flight. */
  isRefreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Optimistic local write — the next reload still wins. */
  setData: (updater: (prev: T) => T) => void;
}

/**
 * One loading/error contract for every screen in the panel.
 *
 * This only wraps the *fetching* concern: the request itself still goes through
 * `lib/api` and its BFF proxy, and nothing here touches session handling.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncData<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keeps the latest fetcher without making `reload` change identity on every
  // render — pages pass inline closures.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const loadedOnce = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (loadedOnce.current) setIsRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (!alive.current) return;
      setDataState(result);
      setError(null);
    } catch (err) {
      if (!alive.current) return;
      setError(errorMessage(err));
    } finally {
      if (alive.current) {
        loadedOnce.current = true;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater: (prev: T) => T) => {
    setDataState((prev) => (prev == null ? prev : updater(prev)));
  }, []);

  return { data, isLoading, isRefreshing, error, reload, setData };
}
