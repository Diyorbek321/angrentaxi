// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

/**
 * "Yangilandi" holati faqat topbarda turadi (PANEL-UI-KIT §4). Topbardagi
 * "Yangilash" tugmasi esa joriy sahifaning ma'lumotini ham yangilashi kerak —
 * sahifa o'z `reload`ini shu yerda ro'yxatdan o'tkazadi.
 */
interface PageRefreshValue {
  register: (fn: () => unknown) => () => void;
  refreshAll: () => Promise<void>;
}

const PageRefreshContext = createContext<PageRefreshValue>({
  register: () => () => {},
  refreshAll: async () => {},
});

export function PageRefreshProvider({ children }: { children: ReactNode }) {
  const fns = useRef(new Set<() => unknown>());

  const register = useCallback((fn: () => unknown) => {
    fns.current.add(fn);
    return () => {
      fns.current.delete(fn);
    };
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled(Array.from(fns.current, (fn) => Promise.resolve(fn())));
  }, []);

  const value = useMemo(() => ({ register, refreshAll }), [register, refreshAll]);
  return <PageRefreshContext.Provider value={value}>{children}</PageRefreshContext.Provider>;
}

/** Sahifa `reload`ini topbar "Yangilash" tugmasiga ulaydi. */
export function usePageRefresh(reload: () => unknown): void {
  const { register } = useContext(PageRefreshContext);
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => register(() => ref.current()), [register]);
}

export function useRefreshAll(): () => Promise<void> {
  return useContext(PageRefreshContext).refreshAll;
}
