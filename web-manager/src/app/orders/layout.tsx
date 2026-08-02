'use client';

import { DispatchShell } from '@/components/dispatch/DispatchShell';

// /orders sits outside the /dispatch segment, so it needs the shell wired up
// explicitly — otherwise the page renders with no sidebar or header at all.
export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <DispatchShell>{children}</DispatchShell>;
}
