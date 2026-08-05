'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncStatus = 'loading' | 'ready' | 'error';

export interface AsyncData<T> {
  data: T | null;
  status: AsyncStatus;
  error: string | null;
  /** Fonda yangilanmoqda — skeletni qaytadan ko'rsatmaydi. */
  isRefreshing: boolean;
  reload: () => Promise<void>;
  setData: (updater: (prev: T | null) => T | null) => void;
}

export function errorMessage(err: unknown): string {
  const response = (err as { response?: { data?: { message?: string } } })?.response;
  if (response?.data?.message) return response.data.message;
  if (err instanceof Error && err.message) return err.message;
  return "Server bilan bog'lanib bo'lmadi";
}

/**
 * Har bir sahifa uchun bir xil yuklash/xato/qayta urinish shartnomasi.
 *
 * `pollMs` berilsa ma'lumot fonda yangilanadi — bunda `status` 'ready'
 * bo'lib qoladi, ya'ni skelet qayta chaqnamaydi va sahifa sakramaydi.
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  { pollMs, enabled = true }: { pollMs?: number; enabled?: boolean } = {}
): AsyncData<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const hasData = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (hasData.current) setIsRefreshing(true);
    else setStatus('loading');

    try {
      const result = await loaderRef.current();
      if (!alive.current) return;
      hasData.current = true;
      setDataState(result);
      setError(null);
      setStatus('ready');
    } catch (err) {
      if (!alive.current) return;
      setError(errorMessage(err));
      // Ma'lumot allaqachon bor bo'lsa uni o'chirmaymiz — fon yangilanishi
      // uzilgani butun ekranni xatoga aylantirmasligi kerak.
      if (!hasData.current) setStatus('error');
    } finally {
      if (alive.current) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    run();
    if (!pollMs) return;
    const id = setInterval(run, pollMs);
    return () => clearInterval(id);
  }, [run, pollMs, enabled]);

  const setData = useCallback((updater: (prev: T | null) => T | null) => {
    setDataState((prev) => updater(prev));
  }, []);

  return { data, status, error, isRefreshing, reload: run, setData };
}
