'use client';

import { DispatchShell } from '@/components/dispatch/DispatchShell';

export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  return <DispatchShell>{children}</DispatchShell>;
}
