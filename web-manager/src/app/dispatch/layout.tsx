'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Car,
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  LogOut,
  Wifi,
  WifiOff,
  Menu,
  X,
  DollarSign,
  Tag,
  Gift,
  MessageCircle,
  AlertTriangle,
  ShieldQuestion,
  Users,
} from 'lucide-react';
import { isAuthenticated, logout, getUser } from '@/lib/auth';
import { useSocket } from '@/hooks/useSocket';
import { getCurrentUserProfile } from '@/lib/api';
import { clsx } from 'clsx';

// `perm` is the RBAC permission required to see this item — see the backend
// Permission enum. `null` means always visible (no gate) — used for Overview
// and Shift Report, which are basic business visibility every manager should
// have regardless of finer permissions. ADMIN bypasses this filter entirely
// (see below); MANAGER accounts only see gated items they've been granted
// from web-admin's Staff & Roles screen.
const navLinks = [
  { href: '/dispatch/overview', label: 'Overview', icon: LayoutDashboard, perm: null },
  { href: '/dispatch', label: 'Dispatch', icon: LayoutDashboard, perm: 'dispatch' },
  { href: '/dispatch/exceptions', label: 'Exceptions', icon: AlertTriangle, perm: 'dispatch' },
  { href: '/orders', label: 'Orders', icon: ClipboardList, perm: 'dispatch' },
  { href: '/create-order', label: 'Create Order', icon: PlusCircle, perm: 'dispatch' },
  { href: '/dispatch/drivers', label: 'Drivers', icon: Users, perm: 'drivers_view' },
  { href: '/dispatch/audit-log', label: 'Audit Log', icon: ShieldQuestion, perm: 'dispatch' },
  { href: '/dispatch/shift-report', label: 'Shift Report', icon: ShieldQuestion, perm: 'dispatch' },
  { href: '/dispatch/finance', label: 'Finance', icon: DollarSign, perm: 'withdrawals_view' },
  { href: '/dispatch/tariffs', label: 'Tariffs', icon: Tag, perm: 'tariffs_manage' },
  { href: '/dispatch/promo-codes', label: 'Promo Codes', icon: Tag, perm: 'promo_manage' },
  { href: '/dispatch/bonuses', label: 'Bonuses', icon: Gift, perm: 'bonuses_view' },
  { href: '/dispatch/support', label: 'Support', icon: MessageCircle, perm: 'support_manage' },
] as const;

export default function DispatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSocket();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Read localStorage after mount, not during render — a `typeof window`
  // check in the render body renders `null` on the server and a real value
  // on the client's first paint, which is a guaranteed hydration mismatch.
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setUser(getUser());
  }, []);

  useEffect(() => {
    getCurrentUserProfile()
      .then((profile) => {
        setIsAdmin(profile.role === 'admin');
        setPermissions(profile.permissions);
      })
      .catch(() => setPermissions([]));
  }, []);

  // Hide nav items entirely rather than disable them — a dispatch-only
  // manager shouldn't even see that Tariffs/Promo/Finance exist. ADMIN
  // always sees everything; while permissions are still loading, show
  // nothing gated yet to avoid a flash of items that then disappear.
  const visibleLinks = navLinks.filter(
    (link) => link.perm === null || isAdmin || (permissions ?? []).includes(link.perm)
  );

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [router]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-[#080D1A] flex flex-col">
      {/* Top nav */}
      <header className="h-14 bg-[#0D1526]/90 backdrop-blur border-b border-white/[0.06] flex items-center px-4 gap-4 shrink-0 sticky top-0 z-40">
        {/* Logo */}
        <Link href="/dispatch" className="flex items-center gap-2.5 shrink-0">
          <div className="h-7 w-7 rounded-lg bg-[#FACC15] flex items-center justify-center shadow-glow-yellow">
            <Car size={15} className="text-[#080D1A]" />
          </div>
          <span className="font-bold text-[#F1F5F9] hidden sm:block">Angren Taxi</span>
          <span className="text-xs text-[#94A3B8]/60 hidden md:block">Dispatcher</span>
        </Link>

        {/* Desktop nav — icon-only between sm/lg (7 items won't fit with full
            labels at that width), full icon+label from lg up */}
        <nav className="hidden sm:flex items-center gap-1 flex-1 min-w-0">
          {visibleLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={label}
              className={clsx(
                'flex items-center gap-2 px-2.5 lg:px-3 py-2 rounded-md text-sm transition-colors shrink-0',
                pathname === href
                  ? 'bg-[#FACC15]/10 text-[#FACC15] border border-[#FACC15]/20'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
              )}
            >
              <Icon size={15} />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Socket status */}
          <div
            className={clsx(
              'flex items-center gap-1.5 text-xs',
              status === 'connected'
                ? 'text-[#10B981]'
                : status === 'connecting'
                ? 'text-[#FACC15]'
                : 'text-[#94A3B8]/50'
            )}
            title={`WebSocket: ${status}`}
          >
            {status === 'connected' ? (
              <Wifi size={14} />
            ) : (
              <WifiOff size={14} />
            )}
            <span className="hidden sm:block capitalize">{status}</span>
          </div>

          {/* User info */}
          {user && (
            <div className="hidden md:flex items-center gap-2 text-xs text-[#94A3B8]">
              <div className="h-6 w-6 rounded-full bg-[#FACC15] flex items-center justify-center text-[#080D1A] text-xs font-bold">
                {(user.firstName ?? user.phone).charAt(0).toUpperCase()}
              </div>
              <span>{user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user.phone}</span>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1.5 rounded hover:bg-red-500/10"
            title="Logout"
          >
            <LogOut size={14} />
            <span className="hidden sm:block">Logout</span>
          </button>

          {/* Mobile menu toggle */}
          <button
            className="sm:hidden text-[#94A3B8] hover:text-[#F1F5F9] p-1"
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Mobile nav dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-[#0D1526] border-b border-white/[0.06] px-4 py-2 space-y-1">
          {visibleLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileMenuOpen(false)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                pathname === href
                  ? 'bg-[#FACC15]/10 text-[#FACC15] border border-[#FACC15]/20'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
