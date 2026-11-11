// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { Fragment, createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { persistLocale, setActiveLocale, type Locale } from './core';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * `initialLocale` root layout'da cookie'dan o'qiladi (`getServerLocale`).
 *
 * Faol tilni render paytida o'rnatamiz (effect'da emas): bolalar shu
 * renderning o'zida `t()` ni chaqiradi va to'g'ri tilni olishi kerak.
 */
export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  setActiveLocale(locale);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      persistLocale(next);
      setActiveLocale(next);
      document.documentElement.lang = next;
      setLocaleState(next);
      // Server komponentlar (sarlavhalar, metadata) ham yangi tilda chizilsin.
      router.refresh();
    },
    [locale, router]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale }}>
      {/* key: til almashganda butun daraxt qayta o'rnatiladi — `t()` ni
          hook'siz chaqirgan joylar ham yangilanadi. */}
      <Fragment key={locale}>{children}</Fragment>
    </I18nContext.Provider>
  );
}

/** Like `useLocale`, but returns null outside `<I18nProvider>` (kit components that must not crash). */
export function useOptionalLocale(): I18nContextValue | null {
  return useContext(I18nContext);
}

export function useLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLocale must be used inside <I18nProvider>');
  return ctx;
}
