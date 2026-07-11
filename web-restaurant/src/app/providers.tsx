'use client';

import React from 'react';
import { AuthContext, useAuthState } from '@/hooks/useAuth';
import { ToastContextProvider } from '@/components/ui/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const authState = useAuthState();

  return (
    <ToastContextProvider>
      <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
    </ToastContextProvider>
  );
}
