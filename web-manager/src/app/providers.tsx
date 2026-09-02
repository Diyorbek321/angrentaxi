'use client';

import type { ReactNode } from 'react';
import { ToastContextProvider } from '@/components/ui/Toast';

/**
 * App-wide client providers, mounted once in the root layout (same pattern as
 * web-market/src/app/providers.tsx). Auth state here is cookie-based and read
 * per-screen, so the only global provider this panel needs is the toast bus.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <ToastContextProvider>{children}</ToastContextProvider>;
}
