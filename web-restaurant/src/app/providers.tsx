'use client';

import React from 'react';
import { AuthContext, useAuthState } from '@/hooks/useAuth';
import { ToastContextProvider } from '@/components/ui/Toast';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import type { Locale } from '@/lib/i18n/core';
import { KioskProvider } from '@/lib/kiosk-context';

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  // I18nProvider eng tashqarida: til almashganda butun daraxt (toast'lar ham)
  // yangi tilda qayta o'rnatiladi.
  return (
    <I18nProvider initialLocale={locale}>
      <AppProviders>{children}</AppProviders>
    </I18nProvider>
  );
}

function AppProviders({ children }: { children: React.ReactNode }) {
  const authState = useAuthState();

  return (
    <ToastContextProvider>
      <AuthContext.Provider value={authState}>
        <KioskProvider>{children}</KioskProvider>
      </AuthContext.Provider>
    </ToastContextProvider>
  );
}
