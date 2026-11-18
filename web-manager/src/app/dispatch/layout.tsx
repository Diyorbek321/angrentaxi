import { cookies } from 'next/headers';
import { DispatchShell } from '@/components/dispatch/DispatchShell';
import { SIDEBAR_COOKIE, SIDEBAR_COLLAPSED } from '@/lib/ui-prefs';

// Server component on purpose: reading the sidebar cookie here means the
// initial HTML already has the right rail width — no flash-on-load, no
// hydration mismatch (localStorage could only deliver one or the other).
export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  const collapsed = cookies().get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;
  return <DispatchShell initialCollapsed={collapsed}>{children}</DispatchShell>;
}
