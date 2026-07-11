'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  ClipboardList,
  Package,
  Tags,
  Boxes,
  BarChart3,
  Settings,
  Search,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { marketApi, Store } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutGrid },
  { href: '/dashboard/orders', label: 'Buyurtmalar', icon: ClipboardList },
  { href: '/dashboard/products', label: 'Mahsulotlar', icon: Package },
  { href: '/dashboard/categories', label: 'Kategoriyalar', icon: Tags },
  { href: '/dashboard/stock', label: 'Zaxira', icon: Boxes },
  { href: '/dashboard/reports', label: 'Hisobotlar', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
];

const TITLES: Record<string, [string, string]> = {
  '/dashboard': ['Bosh sahifa', 'Bugungi savdo va zaxira holati'],
  '/dashboard/orders': ['Buyurtmalar', 'Yangi va faol buyurtmalarni boshqaring'],
  '/dashboard/products': ['Mahsulotlar', 'Katalog va zaxirani boshqaring'],
  '/dashboard/categories': ['Kategoriyalar', 'Mahsulot guruhlari va tartibi'],
  '/dashboard/stock': ['Zaxira', 'Kam va tugagan mahsulotlar'],
  '/dashboard/reports': ['Hisobotlar', 'Savdo tahlili va statistika'],
  '/dashboard/settings': ['Sozlamalar', "Do'kon profili va yetkazib berish"],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [hasCritical, setHasCritical] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const refresh = async () => {
      try {
        const [storeRes, ordersRes, dashRes] = await Promise.all([
          marketApi.getStore(),
          marketApi.getOrders('new'),
          marketApi.getDashboard(),
        ]);
        setStore(storeRes.data.data);
        setNewOrdersCount(ordersRes.data.data.length);
        setHasCritical(dashRes.data.data.outOfStockCount > 0);
      } catch {
        // handled globally by the 401 interceptor
      }
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-yellow border-t-transparent" />
      </div>
    );
  }

  const [pageTitle, pageSub] = TITLES[pathname] ?? ['', ''];
  const initials = [user?.firstName, user?.lastName].filter(Boolean).map((s) => s![0]).join('').toUpperCase() || 'DB';

  return (
    <div className="flex h-screen w-full bg-brand-black text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[252px] flex-shrink-0 bg-brand-dark border-r border-white/[0.06] flex flex-col p-3.5">
        <div className="flex items-center gap-[11px] px-2 pt-1.5 pb-[22px]">
          <div
            className="w-[38px] h-[38px] rounded-[11px] bg-gradient-to-br from-brand-yellow to-amber-500 flex items-center justify-center flex-shrink-0"
            style={{ boxShadow: '0 6px 18px rgba(250,204,21,0.25)' }}
          >
            <Package className="h-5 w-5 text-brand-dark" strokeWidth={2.4} />
          </div>
          <div>
            <div className="text-[15px] font-extrabold leading-tight tracking-tight whitespace-nowrap">Angren Market</div>
            <div className="text-[11px] text-slate-500 font-semibold mt-[3px]">Sotuvchi paneli</div>
          </div>
        </div>

        <nav className="flex flex-col gap-[3px] flex-1">
          {NAV.map((item) => {
            const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-[11px] rounded-[11px] text-[13.5px] font-semibold transition-colors hover:bg-white/[0.04] ${
                  active ? 'bg-brand-yellow/10 text-brand-yellow' : 'text-slate-400'
                }`}
              >
                {active && (
                  <span className="absolute -left-3.5 top-2 bottom-2 w-[3px] rounded-r-[3px] bg-brand-yellow" />
                )}
                <Icon className="h-[19px] w-[19px]" strokeWidth={2} />
                {item.label}
                {item.href === '/dashboard/orders' && newOrdersCount > 0 && (
                  <span className="ml-auto bg-brand-yellow text-brand-dark text-[11px] font-extrabold min-w-[20px] h-5 px-1.5 rounded-[10px] flex items-center justify-center">
                    {newOrdersCount}
                  </span>
                )}
                {item.href === '/dashboard/stock' && hasCritical && (
                  <span
                    className="ml-auto w-2 h-2 rounded-full bg-red-500"
                    style={{ boxShadow: '0 0 0 4px rgba(239,68,68,0.18)' }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3.5 p-[13px] rounded-[14px] bg-white/[0.03] border border-white/[0.06] flex items-center gap-[11px]">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center font-extrabold text-sm text-green-950 flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">
              {store?.name ?? '...'}
            </div>
            <div className="text-[11px] text-green-500 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {store?.status === 'closed' ? 'Yopiq' : 'Ochiq'}
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-[70px] flex-shrink-0 border-b border-white/[0.06] flex items-center justify-between px-7 bg-brand-dark/50">
          <div>
            <div className="text-[18px] font-extrabold tracking-tight">{pageTitle}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{pageSub}</div>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-[11px] px-3 py-2 w-[250px]">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                placeholder="Qidirish..."
                className="bg-transparent border-none text-slate-200 text-sm w-full outline-none placeholder:text-slate-500"
              />
            </div>
            <button className="relative w-10 h-10 rounded-[11px] bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-slate-400 hover:bg-white/[0.08]">
              <Bell className="h-[18px] w-[18px]" />
              {newOrdersCount > 0 && (
                <span className="absolute top-2 right-2.5 w-[7px] h-[7px] rounded-full bg-red-500 border-2 border-brand-dark" />
              )}
            </button>
            <div className="w-10 h-10 rounded-[11px] bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center font-extrabold text-sm text-green-950">
              {initials}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-7">{children}</div>
      </main>
    </div>
  );
}
