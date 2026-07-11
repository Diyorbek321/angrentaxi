'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  ClipboardList,
  UtensilsCrossed,
  Tags,
  BarChart3,
  Settings,
  Bell,
  RotateCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { foodApi, Restaurant } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutGrid },
  { href: '/dashboard/orders', label: 'Buyurtmalar', icon: ClipboardList },
  { href: '/dashboard/menu', label: 'Menyu', icon: UtensilsCrossed },
  { href: '/dashboard/categories', label: 'Kategoriyalar', icon: Tags },
  { href: '/dashboard/reports', label: 'Hisobotlar', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
];

const TITLES: Record<string, [string, string]> = {
  '/dashboard': ['Bosh sahifa', "Bugungi faoliyat ko'rsatkichlari"],
  '/dashboard/orders': ['Buyurtmalar', 'Real vaqtli buyurtmalar boshqaruvi'],
  '/dashboard/menu': ['Menyu', 'Taomlar va narxlar boshqaruvi'],
  '/dashboard/categories': ['Kategoriyalar', "Menyu bo'limlarini tartiblang"],
  '/dashboard/reports': ['Hisobotlar', 'Tushum va statistika'],
  '/dashboard/settings': ['Sozlamalar', 'Restoran profili va ish rejimi'],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const refresh = async () => {
    try {
      const [restaurantRes, ordersRes] = await Promise.all([foodApi.getRestaurant(), foodApi.getOrders()]);
      setRestaurant(restaurantRes.data.data);
      setNewOrdersCount(ordersRes.data.data.filter((o) => o.status === 'new').length);
    } catch {
      // handled globally by the 401 interceptor
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const doRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const toggleOpen = async () => {
    const res = await foodApi.toggleOpen();
    setRestaurant(res.data.data);
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-yellow border-t-transparent" />
      </div>
    );
  }

  const [pageTitle, pageSub] = TITLES[pathname] ?? ['', ''];
  const initial = (restaurant?.name ?? user?.firstName ?? 'M').charAt(0).toUpperCase();
  const isOpen = restaurant?.status === 'active';

  return (
    <div className="flex h-screen w-full bg-brand-black text-slate-200 overflow-hidden">
      <aside className="w-[256px] flex-shrink-0 bg-brand-dark border-r border-white/[0.07] flex flex-col p-4">
        <div className="flex items-center gap-[11px] px-2 pt-1.5 pb-[22px]">
          <div
            className="w-10 h-10 rounded-xl bg-brand-yellow flex items-center justify-center font-extrabold text-xl text-brand-black"
            style={{ boxShadow: '0 0 20px rgba(250,204,21,0.25)' }}
          >
            {initial}
          </div>
          <div>
            <div className="text-[15px] font-extrabold leading-tight tracking-tight">
              {restaurant?.name ?? '...'}
            </div>
            <div className="text-[11px] text-slate-500 font-semibold tracking-wide">ANGREN TAXI · Restoran</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map((item) => {
            const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-[11px] rounded-xl text-sm font-medium transition-all ${
                  active ? 'bg-brand-yellow text-brand-black font-bold shadow-[0_0_20px_rgba(250,204,21,0.25)]' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="flex-1">{item.label}</span>
                {item.href === '/dashboard/orders' && newOrdersCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-400 text-white text-[11px] font-bold flex items-center justify-center animate-pulse">
                    {newOrdersCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2.5 pt-3.5 border-t border-white/[0.07]">
          <div className="flex items-center gap-2.5 px-3 py-[11px] rounded-[14px] bg-[#111827] border border-white/[0.07]">
            <div className="w-9 h-9 rounded-full bg-brand-yellow text-brand-black flex items-center justify-center font-extrabold text-[15px]">
              {(user?.firstName ?? 'M').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold truncate">Menejer</div>
              <div className="text-[11px] text-slate-500">Smena · Faol</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="flex items-center gap-3.5 px-6 py-4 border-b border-white/[0.07] bg-brand-dark/70 backdrop-blur-md flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-[19px] font-extrabold tracking-tight truncate">{pageTitle}</h1>
            <p className="text-[12.5px] text-slate-500 mt-0.5">{pageSub}</p>
          </div>

          <button
            onClick={toggleOpen}
            className={`inline-flex items-center gap-2 px-3.5 py-[7px] rounded-full text-[13px] font-bold border ${
              isOpen ? 'text-green-400 border-green-400/35 bg-green-400/[0.09]' : 'text-red-400 border-red-400/35 bg-red-400/[0.09]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-400 shadow-[0_0_8px_#10B981]' : 'bg-red-400'}`} />
            {isOpen ? 'Ochiq' : 'Yopiq'}
          </button>

          <button
            onClick={doRefresh}
            title="Yangilash"
            className="w-10 h-10 rounded-[11px] border border-white/[0.08] text-slate-400 flex items-center justify-center hover:text-slate-200 hover:border-white/20"
          >
            <RotateCw className={`h-[18px] w-[18px] ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button className="relative w-10 h-10 rounded-[11px] border border-white/[0.08] text-slate-400 flex items-center justify-center hover:text-slate-200 hover:border-white/20">
            <Bell className="h-[18px] w-[18px]" />
            {newOrdersCount > 0 && (
              <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-400 border-2 border-brand-dark" />
            )}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 relative">{children}</main>
      </div>
    </div>
  );
}
