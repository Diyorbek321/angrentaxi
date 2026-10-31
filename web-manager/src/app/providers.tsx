'use client';

import type { ReactNode } from 'react';
import { ToastContextProvider } from '@/components/ui/Toast';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import type { Locale } from '@/lib/i18n/core';

/**
 * App-wide client providers, mounted once in the root layout (same pattern as
 * web-market/src/app/providers.tsx). Auth state here is cookie-based and read
 * per-screen; the global providers are the language (outermost, so a language
 * switch remounts everything below it) and the toast bus.
 */
export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <I18nProvider initialLocale={locale}>
      <ToastContextProvider>{children}</ToastContextProvider>
    </I18nProvider>
  );
}
