'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  Car,
  LogOut,
  Menu,
  Search,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { clsx } from 'clsx';
import { isAuthenticated, logout, getUser } from '@/lib/auth';
import { useSocket } from '@/hooks/useSocket';
import { getCurrentUserProfile, getActiveSosAlerts, getNoDriversFoundExceptions } from '@/lib/api';
import { persistSidebarCollapsed } from '@/lib/ui-prefs';
import { formatTime } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NAV_GROUPS, Sidebar, type NavGroup } from './Sidebar';
import { DispatchDataProvider, useDispatchData } from './DispatchDataContext';

const EXCEPTIONS_POLL_MS = 30_000;

/**
 * The connection lifecycle as the operator must see it (control-room rule:
 * silence is the enemy — a frozen panel that looks live is worse than an
 * outage banner):
 *
 *   Jonli (quiet mint) → Ulanmoqda (reconnecting, neutral) → Uzilgan (red —
 *   connection lost is an act-now state) with "maʼlumot HH:MM holatiga koʻra"
 *   the moment freshness is lost, so the last good snapshot stays visible
 *   but honestly labelled.
 */
function ConnectionIndicator() {
  const { status } = useSocket();
  // The moment live updates stopped arriving — feeds the staleness label.
  const [staleSince, setStaleSince] = useState<number | null>(null);
  const prevConnected = useRef(false);

  useEffect(() => {
    if (status === 'connected') {
      prevConnected.current = true;
      setStaleSince(null);
    } else if (prevConnected.current) {
      // Only mark the first moment of loss; reconnect attempts keep it.
      setStaleSince((prev) => prev ?? Date.now());
    }
  }, [status]);

  const state: 'live' | 'reconnecting' | 'stale' =
    status === 'connected' ? 'live' : status === 'connecting' ? 'reconnecting' : 'stale';

  return (
    <div
      role="status"
      aria-live="polite"
      title={`WebSocket: ${status}`}
      className={clsx(
        'hidden sm:flex items-center gap-1.5 h-9 px-2.5 rounded-ds-xs border text-xs',
        state === 'live' && 'border-primary/30 bg-primary/10 text-primary-700 dark:text-primary-300',
        state === 'reconnecting' && 'border-line bg-surface-2/60 text-muted',
        state === 'stale' && 'border-danger/40 bg-danger/10 text-danger'
      )}
    >
      {state === 'live' && <Wifi size={14} />}
      {state === 'reconnecting' && <Wifi size={14} className="animate-pulse" />}
      {state === 'stale' && <WifiOff size={14} />}
      <span className="hidden lg:inline font-medium">
        {state === 'live' ? 'Jonli' : state === 'reconnecting' ? 'Ulanmoqda…' : 'Uzilgan'}
      </span>
      {state !== 'live' && staleSince != null && (
        <span className="hidden xl:inline text-[11px] font-normal">
          · maʼlumot {formatTime(staleSince)} holatiga koʻra
        </span>
      )}
    </div>
  );
}

/** Compact live readout in the header — the numbers an operator glances at. */
function HeaderCounter({
  icon,
  value,
  label,
  loading,
  tone = 'mint',
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  loading: boolean;
  tone?: 'mint' | 'muted';
}) {
  return (
    <div
      title={label}
      className="hidden md:flex items-center gap-2 h-9 px-2.5 rounded-ds-xs border border-line bg-surface-2/60"
    >
      <span className={clsx('shrink-0', tone === 'mint' ? 'text-primary-600 dark:text-primary-300' : 'text-muted')}>
        {icon}
      </span>
      {loading ? (
        <span className="skeleton h-3 w-6 rounded" />
      ) : (
        <span className="font-mono text-sm font-semibold text-ink tabular-nums">{value}</span>
      )}
      <span className="hidden xl:inline text-xs text-muted">{label}</span>
    </div>
  );
}

function ShellHeader({
  onOpenMobileNav,
  exceptionsCount,
  canSeeExceptions,
}: {
  onOpenMobileNav: () => void;
  exceptionsCount: number;
  canSeeExceptions: boolean;
}) {
  const router = useRouter();
  const { orders, ordersLoading, drivers, driversLoading } = useDispatchData();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [query, setQuery] = useState('');

  // localStorage-backed user is read after mount, never during render —
  // reading it in the render body renders one thing on the server and another
  // on the client's first paint, which is a guaranteed hydration mismatch.
  useEffect(() => {
    setUser(getUser());
  }, []);

  const onlineDrivers = drivers.length;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/orders?q=${encodeURIComponent(q)}`);
  };

  const handleLogout = async () => {
    // Awaited so the refresh token is revoked server-side before we navigate —
    // navigating first can cancel the in-flight request and leave it live.
    await logout();
    router.replace('/login');
  };

  return (
    <header className="h-14 shrink-0 bg-surface border-b border-line flex items-center gap-2 px-3 sm:px-4">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Menyuni ochish"
        className="lg:hidden h-9 w-9 inline-flex items-center justify-center rounded-ds-xs text-muted hover:text-ink hover:bg-surface-2 transition-colors"
      >
        <Menu size={18} />
      </button>

      <HeaderCounter
        icon={<Car size={15} />}
        value={orders.length}
        label="Aktiv buyurtmalar"
        loading={ordersLoading && orders.length === 0}
      />
      <HeaderCounter
        icon={<Users size={15} />}
        value={onlineDrivers}
        label="Onlayn haydovchilar"
        loading={driversLoading && drivers.length === 0}
      />

      {canSeeExceptions && (
        <Link
          href="/dispatch/exceptions"
          title="Istisnolar"
          className={clsx(
            'inline-flex items-center gap-1.5 h-9 px-2.5 rounded-ds-xs border text-xs font-semibold transition-colors',
            exceptionsCount > 0
              ? 'border-danger/40 bg-danger/10 text-danger animate-pulse-ring'
              : 'border-line bg-surface-2/60 text-muted hover:text-ink'
          )}
        >
          <AlertTriangle size={15} />
          <span className="hidden sm:inline">Istisnolar</span>
          <span className="font-mono tabular-nums">{exceptionsCount}</span>
        </Link>
      )}

      <form onSubmit={handleSearch} className="ml-auto hidden sm:block relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buyurtma, mijoz, telefon…"
          aria-label="Buyurtmalar boʻyicha qidiruv"
          className="h-9 w-40 lg:w-64 rounded-ds-xs border border-line bg-surface-2/60 pl-9 pr-3 text-sm text-ink placeholder-subtle focus:outline-none focus:ring-2 focus:ring-focus/40 focus:border-focus transition-colors"
        />
      </form>

      <div className="flex items-center gap-2 ml-auto sm:ml-0">
        {canSeeExceptions && (
          <Link
            href="/dispatch/exceptions"
            aria-label="Bildirishnomalar"
            title="Bildirishnomalar"
            className="relative h-9 w-9 inline-flex items-center justify-center rounded-ds-xs border border-line text-muted hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <Bell size={16} />
            {exceptionsCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-danger text-white text-[10px] font-mono font-bold flex items-center justify-center">
                {exceptionsCount > 9 ? '9+' : exceptionsCount}
              </span>
            )}
          </Link>
        )}

        <ThemeToggle />

        <ConnectionIndicator />

        <div className="hidden md:flex items-center gap-2 pl-2 border-l border-line">
          <Avatar name={user?.firstName ?? user?.phone ?? null} size="sm" />
          <div className="min-w-0 max-w-[9rem]">
            <p className="text-xs font-semibold text-ink truncate">
              {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user?.phone ?? '—'}
            </p>
            <p className="text-[11px] text-subtle truncate">Operator</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title="Chiqish"
          aria-label="Chiqish"
          className="h-9 w-9 inline-flex items-center justify-center rounded-ds-xs border border-transparent text-muted hover:text-danger hover:bg-danger/10 transition-colors"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

/**
 * Sidebar + header frame shared by every operator screen. Used from
 * app/dispatch/layout.tsx, app/orders/layout.tsx and
 * app/create-order/layout.tsx — the latter two live outside the /dispatch
 * segment, so without this they would render with no navigation at all.
 */
export function DispatchShell({
  children,
  initialCollapsed = false,
}: {
  children: React.ReactNode;
  /**
   * Comes from the sidebar cookie, read by the server layout — the initial
   * HTML already matches the user's saved preference, so a collapsed rail
   * never flashes open on load.
   */
  initialCollapsed?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [exceptionsCount, setExceptionsCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    getCurrentUserProfile()
      .then((profile) => {
        setIsAdmin(profile.role === 'admin');
        setPermissions(profile.permissions);
      })
      .catch(() => setPermissions([]));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      persistSidebarCollapsed(next);
      return next;
    });
  }, []);

  const canSeeExceptions = isAdmin || (permissions ?? []).includes('dispatch');

  // The Exceptions badge is the number an operator watches all shift, so it
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

  // Hide items entirely rather than disable them — a dispatch-only manager
  // shouldn't even see that Tariffs/Promo/Finance exist. ADMIN always sees
  // everything; while permissions are still loading, show nothing gated yet
  // to avoid a flash of items that then disappear. Groups that end up empty
  // drop their caption too, so a two-item sidebar still looks deliberate.
  const visibleGroups: NavGroup[] = NAV_GROUPS.map((group) => ({
    title: group.title,
    links: group.links.filter(
      (link) => link.perm === null || isAdmin || (permissions ?? []).includes(link.perm)
    ),
  })).filter((group) => group.links.length > 0);

  return (
    <DispatchDataProvider>
      <div className="h-screen flex bg-bg overflow-hidden">
        <Sidebar
          groups={visibleGroups}
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          exceptionsCount={canSeeExceptions ? exceptionsCount : 0}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <ShellHeader
            onOpenMobileNav={() => setMobileOpen(true)}
            exceptionsCount={exceptionsCount}
            canSeeExceptions={canSeeExceptions}
          />
          <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
        </div>
      </div>
    </DispatchDataProvider>
  );
}
