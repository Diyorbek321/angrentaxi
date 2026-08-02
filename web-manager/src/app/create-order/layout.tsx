'use client';

import { DispatchShell } from '@/components/dispatch/DispatchShell';

// Same reason as /orders — this route is outside the /dispatch segment.
export default function CreateOrderLayout({ children }: { children: React.ReactNode }) {
  return <DispatchShell>{children}</DispatchShell>;
}
