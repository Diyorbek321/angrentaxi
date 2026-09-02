'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/components/layout/SidebarContext';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { dashboardApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const iconButton = cn(
  'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-sm border border-line text-muted',
  'transition-colors duration-fast hover:border-line-strong hover:bg-surface-2 hover:text-ink',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
);

/**
 * Panelning yuqori bari. Sahifa SARLAVHASI bu yerda emas — u har bir
 * sahifadagi `PageHeader` da, shunda 19 ta sahifada bitta `h1` bo'ladi va
 * sarlavha ikki marta takrorlanmaydi.
 *
 * Qo'ng'iroqcha HAQIQIY holatga bog'langan: kutilayotgan haydovchi arizalari
 * soni (`pendingDriverApprovals`). Doim yonib turadigan badge operatorni
 * barcha badge'larni e'tiborsiz qoldirishga o'rgatadi — shuning uchun nuqta
 * faqat soni > 0 bo'lgandagina chiqadi.
 */
export function Header() {
  const { user } = useAuth();
  const { toggle } = useSidebar();
  const router = useRouter();
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchPending = () => {
      dashboardApi
        .getStats()
        .then((res) => {
          if (!cancelled) setPendingApprovals(res.data.data?.pendingDriverApprovals ?? 0);
        })
        .catch(() => {
          /* badge shunchaki ko'rinmaydi — yolg'on nuqtadan ko'ra yaxshiroq */
        });
    };

    fetchPending();
    const interval = setInterval(fetchPending, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const bellLabel =
    pendingApprovals > 0
      ? `${pendingApprovals} ta haydovchi arizasi kutilmoqda`
      : 'Yangi bildirishnoma yo‘q';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={toggle}
        className={cn(iconButton, 'lg:hidden')}
        aria-label="Menyuni ochish"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="flex flex-1 items-center justify-end gap-3">
        <ThemeToggle />

        <button
          type="button"
          className={iconButton}
          aria-label={bellLabel}
          title={bellLabel}
          onClick={() => router.push('/dashboard/drivers?status=pending')}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {pendingApprovals > 0 && (
            /* `danger-deep` (#B91C1C): oq matn bilan 6.47:1 AA — `danger`
               DEFAULT (3.91:1) mayda matn uchun yetarli emas edi. */
            <span
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-deep px-1 font-mono text-[10px] font-bold tabular-nums text-white"
              aria-hidden="true"
            >
              {pendingApprovals > 99 ? '99+' : pendingApprovals}
            </span>
          )}
        </button>

        {user && (
          <div className="flex items-center gap-2.5">
            <Avatar name={`${user.firstName ?? ''} ${user.lastName ?? ''}`} size="sm" />
            <div className="hidden sm:block">
              <p className="text-body font-medium text-ink">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-caption text-muted">Administrator</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
