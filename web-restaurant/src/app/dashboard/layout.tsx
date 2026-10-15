import { cookies } from 'next/headers';
import { RestaurantShell } from '@/components/restaurant-shell/RestaurantShell';
import { PageRefreshProvider } from '@/components/shell';
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from '@/lib/ui-prefs';

// Server komponent ataylab: sidebar cookie shu yerda o'qiladi, birinchi HTML
// to'g'ri rail kengligi bilan chiqadi — chaqnash ham, hidratsiya farqi ham yo'q.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const collapsed = cookies().get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;
  return (
    <PageRefreshProvider>
      <RestaurantShell initialCollapsed={collapsed}>{children}</RestaurantShell>
    </PageRefreshProvider>
  );
}
