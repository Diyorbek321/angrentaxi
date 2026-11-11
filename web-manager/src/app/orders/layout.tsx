import { cookies } from 'next/headers';
import { DispatchShell } from '@/components/dispatch/DispatchShell';
import { SIDEBAR_COOKIE, SIDEBAR_COLLAPSED } from '@/lib/ui-prefs';

// /orders sits outside the /dispatch segment, so it needs the shell wired up
// explicitly — otherwise the page renders with no sidebar or header at all.
// Server component for the same no-flash reason as app/dispatch/layout.tsx.
export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  const collapsed = cookies().get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;
  return <DispatchShell initialCollapsed={collapsed}>{children}</DispatchShell>;
}
