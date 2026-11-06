'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Car, Wallet } from 'lucide-react';
import {
  AppShell,
  LiveDivider,
  LiveMetric,
  LiveStatus,
  type LiveState,
  type NavGroup,
  type ShellUser,
} from '@/components/shell';
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi, withdrawalsApi } from '@/lib/api';
import { SIDEBAR_COOKIE } from '@/lib/ui-prefs';
import { t } from '@/locales';
import { adminNav, DRIVERS_HREF, PENDING_DRIVERS_HREF, WITHDRAWALS_HREF } from './nav-config';

const PENDING_POLL_MS = 60_000;

interface PendingCounts {
  driverApprovals: number | null;
  withdrawals: number | null;
}

/**
 * Real "waiting for an admin" counts — the admin's live slot. Each count is
 * fetched independently; a failed poll keeps the last good value (a badge
 * that blinks to 0 on a network hiccup would be a lie).
 */
function usePendingCounts(enabled: boolean) {
  const [counts, setCounts] = useState<PendingCounts>({ driverApprovals: null, withdrawals: null });
  const [state, setState] = useState<LiveState>('connecting');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      const [stats, payouts] = await Promise.allSettled([
        dashboardApi.getStats(),
        withdrawalsApi.getAll({ status: 'pending', page: 1, limit: 1 }),
      ]);
      if (cancelled) return;
      setCounts((prev) => ({
        driverApprovals:
          stats.status === 'fulfilled'
            ? stats.value.data.data?.pendingDriverApprovals ?? 0
            : prev.driverApprovals,
        withdrawals:
          payouts.status === 'fulfilled' ? payouts.value.data.data?.total ?? 0 : prev.withdrawals,
      }));
      const ok = stats.status === 'fulfilled' || payouts.status === 'fulfilled';
      if (ok) setUpdatedAt(Date.now());
      setState((prev) => (ok ? 'live' : prev === 'connecting' ? 'offline' : 'stale'));
    };

    void load();
    const interval = setInterval(() => void load(), PENDING_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  return { counts, state, updatedAt };
}

function ContentSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-5 space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-72" />
      </div>
      <SkeletonTable rows={8} cols={5} />
    </div>
  );
}

/**
 * Super-admin frame for every /dashboard route. Chrome comes from the shared
 * shell; this file owns only admin data: auth redirect, user card and the
 * pending-approval counters in the topbar live slot.
 */
export function AdminShell({
  children,
  initialCollapsed = false,
}: {
  children: ReactNode;
  initialCollapsed?: boolean;
}) {
  const m = t();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  const { counts, state, updatedAt } = usePendingCounts(isAuthenticated);

  const shellUser: ShellUser | null = useMemo(
    () =>
      user
        ? { firstName: user.firstName, lastName: user.lastName, phone: user.phone, role: m.shell.roleAdministrator }
        : null,
    [user, m]
  );

  // Badges are bound to real pending state and vanish at 0.
  const nav: NavGroup[] = useMemo(
    () =>
      adminNav().map((group) => ({
        ...group,
        items: group.items.map((item) => {
          if (item.href === DRIVERS_HREF) return { ...item, badge: counts.driverApprovals };
          if (item.href === WITHDRAWALS_HREF) return { ...item, badge: counts.withdrawals };
          return item;
        }),
      })),
    [counts]
  );

  const handleSearch = useCallback(
    (q: string) => router.push(`/dashboard/users?q=${encodeURIComponent(q)}`),
    [router]
  );

  const loadingCounts = state === 'connecting';
  const live = (
    <>
      <LiveMetric
        icon={<Car aria-hidden />}
        value={counts.driverApprovals}
        label={m.shell.pendingDrivers}
        href={PENDING_DRIVERS_HREF}
        loading={loadingCounts && counts.driverApprovals == null}
      />
      <LiveMetric
        icon={<Wallet aria-hidden />}
        value={counts.withdrawals}
        label={m.shell.pendingWithdrawals}
        href={WITHDRAWALS_HREF}
        loading={loadingCounts && counts.withdrawals == null}
      />
      <LiveDivider />
      <LiveStatus state={state} updatedAt={state === 'live' ? null : updatedAt} />
    </>
  );

  return (
    <AppShell
      brand={{ name: 'Angren Taxi', subtitle: 'Super Admin', href: '/dashboard' }}
      nav={nav}
      user={isLoading ? null : shellUser}
      onLogout={logout}
      initialCollapsed={initialCollapsed}
      collapseCookie={SIDEBAR_COOKIE}
      onSearch={handleSearch}
      searchPlaceholder={m.shell.searchPlaceholder}
      live={isAuthenticated ? live : null}
    >
      {isLoading ? <ContentSkeleton /> : isAuthenticated ? children : null}
    </AppShell>
  );
}
