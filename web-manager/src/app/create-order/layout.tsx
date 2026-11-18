import { cookies } from 'next/headers';
import { DispatchShell } from '@/components/dispatch/DispatchShell';
import { SIDEBAR_COOKIE, SIDEBAR_COLLAPSED } from '@/lib/ui-prefs';

// Same reason as /orders — this route is outside the /dispatch segment.
// Server component for the same no-flash reason as app/dispatch/layout.tsx.
export default function CreateOrderLayout({ children }: { children: React.ReactNode }) {
  const collapsed = cookies().get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;
  return <DispatchShell initialCollapsed={collapsed}>{children}</DispatchShell>;
}
