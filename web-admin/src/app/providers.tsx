'use client';

import React from 'react';
import { AuthContext, useAuthState } from '@/hooks/useAuth';
import { ToastContextProvider } from '@/components/ui/Toast';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import type { Locale } from '@/lib/i18n/core';

function AuthProviders({ children }: { children: React.ReactNode }) {
  const authState = useAuthState();

  return (
    <ToastContextProvider>
      <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
    </ToastContextProvider>
  );
}

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <I18nProvider initialLocale={locale}>
      <AuthProviders>{children}</AuthProviders>
    </I18nProvider>
  );
}
