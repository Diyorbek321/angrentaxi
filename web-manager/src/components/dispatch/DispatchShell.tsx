'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, Car, Users } from 'lucide-react';
import { isAuthenticated, logout, getUser } from '@/lib/auth';
import { useSocket } from '@/hooks/useSocket';
import { getCurrentUserProfile, getActiveSosAlerts, getNoDriversFoundExceptions } from '@/lib/api';
import { SIDEBAR_COOKIE } from '@/lib/ui-prefs';
import {
  AppShell,
  LiveDivider,
  LiveMetric,
  LiveStatus,
  liveStateFromSocket,
  type NavGroup,
  type ShellUser,
} from '@/components/shell';
import { IconButton } from '@/components/ui/IconButton';
import { DISPATCH_NAV, EXCEPTIONS_HREF } from './nav-config';
import { DispatchDataProvider, useDispatchData } from './DispatchDataContext';

const EXCEPTIONS_POLL_MS = 30_000;

/**
 * Socket lifecycle as the operator must see it: Jonli → Qayta ulanmoqda →
 * Eskirgan (with "HH:MM holatiga" — the last moment data was live), so a
 * frozen panel never looks live. This is the ONE freshness readout.
 */
function ConnectionStatus() {
  const { status } = useSocket();
  const hadConnection = useRef(false);
  const [lastLiveAt, setLastLiveAt] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'connected') {
      hadConnection.current = true;
      setLastLiveAt(null);
    } else if (hadConnection.current) {
      setLastLiveAt((prev) => prev ?? Date.now());
    }
  }, [status]);

  return (
    <LiveStatus
      state={liveStateFromSocket(status, hadConnection.current)}
      updatedAt={status === 'connected' ? null : lastLiveAt}
    />
  );
}

/** Topbar live slot: active orders · online drivers · exceptions · connection. */
function DispatchLiveSlot({
  exceptionsCount,
  canSeeExceptions,
}: {
  exceptionsCount: number;
  canSeeExceptions: boolean;
}) {
  const { orders, ordersLoading, drivers, driversLoading } = useDispatchData();
  return (
    <>
      <LiveMetric
        icon={<Car aria-hidden />}
        value={orders.length}
        label="Aktiv buyurtmalar"
        loading={ordersLoading && orders.length === 0}
      />
      <LiveMetric
        icon={<Users aria-hidden />}
        value={drivers.length}
        label="Onlayn haydovchilar"
        loading={driversLoading && drivers.length === 0}
      />
      {canSeeExceptions && (
        <LiveMetric
          icon={<AlertTriangle aria-hidden />}
          value={exceptionsCount}
          label="Istisnolar"
          href={EXCEPTIONS_HREF}
          tone={exceptionsCount > 0 ? 'danger' : 'neutral'}
        />
      )}
      <LiveDivider />
      <ConnectionStatus />
    </>
  );
}

/**
 * Operator frame for every screen (app/dispatch, app/orders, app/create-order
 * layouts). Chrome comes from the shared shell; this file owns only the
 * dispatcher's data: auth redirect, RBAC, exceptions poll, live counters.
 */
export function DispatchShell({
  children,
  initialCollapsed = false,
}: {
  children: React.ReactNode;
  /** From the sidebar cookie, read by the server layout — no flash on load. */
  initialCollapsed?: boolean;
}) {
  const router = useRouter();

  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [exceptionsCount, setExceptionsCount] = useState(0);
  const [user, setUser] = useState<ShellUser | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [router]);

  // localStorage-backed user is read after mount, never during render
  // (hydration mismatch otherwise).
  useEffect(() => {
    const u = getUser();
    if (u) setUser({ firstName: u.firstName, lastName: u.lastName, phone: u.phone, role: 'Dispetcher' });
  }, []);

  useEffect(() => {
    getCurrentUserProfile()
      .then((profile) => {
        setIsAdmin(profile.role === 'admin');
        setPermissions(profile.permissions);
        if (profile.role === 'admin') setUser((u) => (u ? { ...u, role: 'Administrator' } : u));
      })
      .catch(() => setPermissions([]));
  }, []);

  const canSeeExceptions = isAdmin || (permissions ?? []).includes('dispatch');

  // The Exceptions count is the number an operator watches all shift, so it
  // keeps ticking regardless of which screen they're on.
  useEffect(() => {
    if (!canSeeExceptions) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [sos, noDrivers] = await Promise.all([
          getActiveSosAlerts(),
          getNoDriversFoundExceptions(1, 1),
        ]);
        if (!cancelled) setExceptionsCount(sos.length + noDrivers.total);
      } catch {
        /* a failed poll must not blank a count the operator is watching */
      }
    };

    load();
    const interval = setInterval(load, EXCEPTIONS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [canSeeExceptions]);

  // Hide items rather than disable them. ADMIN sees everything; while
  // permissions load, gated items stay hidden (no flash of items that vanish).
  const can = useCallback(
    (perm: string) => isAdmin || (permissions ?? []).includes(perm),
    [isAdmin, permissions]
  );

  // Exceptions badge bound to the live count (danger only when > 0).
  const nav: NavGroup[] = useMemo(
    () =>
      DISPATCH_NAV.map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.href === EXCEPTIONS_HREF
            ? { ...item, badge: canSeeExceptions ? exceptionsCount : 0, badgeTone: 'danger' as const }
            : item
        ),
      })),
    [exceptionsCount, canSeeExceptions]
  );

  const handleLogout = useCallback(async () => {
    // Awaited so the refresh token is revoked server-side before navigating.
    await logout();
    router.replace('/login');
  }, [router]);

  const handleSearch = useCallback(
    (q: string) => router.push(`/orders?q=${encodeURIComponent(q)}`),
    [router]
  );

  return (
    <DispatchDataProvider>
      <AppShell
        brand={{ name: 'Angren Taxi', subtitle: 'Dispetcher', href: '/dispatch' }}
        nav={nav}
        can={can}
        user={user}
        onLogout={handleLogout}
        initialCollapsed={initialCollapsed}
        collapseCookie={SIDEBAR_COOKIE}
        onSearch={handleSearch}
        searchPlaceholder="Buyurtma, mijoz, telefon…"
        mainClassName="overflow-hidden"
        live={<DispatchLiveSlot exceptionsCount={exceptionsCount} canSeeExceptions={canSeeExceptions} />}
        actions={
          canSeeExceptions ? (
            <IconButton
              aria-label={exceptionsCount > 0 ? `Bildirishnomalar: ${exceptionsCount}` : 'Bildirishnomalar'}
              badge={exceptionsCount > 0}
              onClick={() => router.push(EXCEPTIONS_HREF)}
            >
              <Bell aria-hidden />
            </IconButton>
          ) : null
        }
      >
        {children}
      </AppShell>
    </DispatchDataProvider>
  );
}
