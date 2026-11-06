import { cookies } from 'next/headers';
import { AdminShell } from '@/components/admin-shell/AdminShell';
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from '@/lib/ui-prefs';

// Server component on purpose: reading the collapse cookie here means the
// initial HTML already has the right rail width — no flash on load.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const collapsed = cookies().get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;
  return <AdminShell initialCollapsed={collapsed}>{children}</AdminShell>;
}
