'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ResourceState<T> {
  data: T | null;
  setData: (next: T) => void;
  loading: boolean;
  error: string | null;
  /** Kamida bir marta muvaffaqiyatli yuklangan — xato bo'lsa oxirgi ma'lumot qoladi. */
  hasLoaded: boolean;
  reload: () => Promise<void>;
}

/**
 * Bitta GET resursi uchun skeleton / xato+qayta urinish / ma'lumot uchligi.
 * `fetcher` o'zgarsa (deps) qayta yuklanadi; eskirgan javob tashlab yuboriladi.
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  errorMessage: string,
  deps: readonly unknown[] = []
): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const requestId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const next = await run();
      if (id !== requestId.current) return;
      setData(next);
      setError(null);
      setHasLoaded(true);
    } catch {
      if (id !== requestId.current) return;
      setError(errorMessage);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [run, errorMessage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, loading, error, hasLoaded, reload };
}
