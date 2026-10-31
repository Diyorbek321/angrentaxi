import { cookies } from 'next/headers';
import { MarketShell } from '@/components/market-shell/MarketShell';
import { PageRefreshProvider } from '@/components/shell';
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from '@/lib/ui-prefs';

// Server komponent ataylab: yon panel cookie'si shu yerda o'qiladi, shuning
// uchun birinchi HTML'dayoq rail kengligi to'g'ri — flash ham, hydration
// mismatch ham yo'q.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const collapsed = cookies().get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;
  return (
    <PageRefreshProvider>
      <MarketShell initialCollapsed={collapsed}>{children}</MarketShell>
    </PageRefreshProvider>
  );
}
