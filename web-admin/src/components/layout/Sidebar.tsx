'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Car,
  ClipboardList,
  Tag,
  BarChart2,
  LogOut,
  Zap,
  Ticket,
  Gift,
  Settings,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/components/layout/SidebarContext';

const navItems = [
  {
    href: '/dashboard',
    label: 'Bosh sahifa',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: '/dashboard/users',
    label: 'Foydalanuvchilar',
    icon: Users,
  },
  {
    href: '/dashboard/drivers',
    label: 'Haydovchilar',
    icon: Car,
  },
  {
    href: '/dashboard/orders',
    label: 'Buyurtmalar',
    icon: ClipboardList,
  },
  {
    href: '/dashboard/tariffs',
    label: 'Tariflar',
    icon: Tag,
  },
  {
    href: '/dashboard/promo-codes',
    label: 'Promo kodlar',
    icon: Ticket,
  },
  {
    href: '/dashboard/bonuses',
    label: 'Bonuslar',
    icon: Gift,
  },
  {
    href: '/dashboard/vendors',
    label: 'Sotuvchilar',
    icon: Store,
  },
  {
    href: '/dashboard/reports',
    label: 'Hisobotlar',
    icon: BarChart2,
  },
  {
    href: '/dashboard/settings',
    label: 'Sozlamalar',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { isOpen, close } = useSidebar();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col bg-[#0D1526] shadow-[4px_0_24px_rgba(0,0,0,0.3)] transition-transform duration-200 ease-out',
          'lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 shadow-glow-yellow-sm">
            <Zap className="h-5 w-5 text-[#080D1A]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Angren Taxi</p>
            <p className="text-xs text-slate-500">Admin Panel</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {/* Section label */}
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Menu
          </p>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className={cn(
                      'flex items-center gap-3 rounded-r-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      active
                        ? 'border-l-2 border-yellow-400 bg-yellow-400/10 text-yellow-400 rounded-l-none'
                        : 'border-l-2 border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white rounded-lg'
                    )}
                  >
                    <item.icon
                      className={cn('h-4 w-4 shrink-0', active ? 'text-yellow-400' : 'text-slate-500')}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User + logout */}
        <div className="border-t border-white/[0.06] p-4 space-y-2">
          {user && (
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-[#080D1A] shadow-glow-yellow-sm">
                {user.firstName?.charAt(0) || 'A'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-slate-500">Admin</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Chiqish
          </button>
        </div>
      </aside>
    </>
  );
}
