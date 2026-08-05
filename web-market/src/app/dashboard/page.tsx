'use client';

import { useCallback, useEffect, useState } from 'react';
import { Boxes, ClipboardList, PackageX, Wallet } from 'lucide-react';
import { marketApi, type DashboardData, type MarketOrder, type Product } from '@/lib/api';
import { formatMoney, formatNumber } from '@/lib/format';
import { StatCard } from '@/components/ui/StatCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonStats } from '@/components/ui/Skeleton';
import { AttentionPanel } from '@/components/dashboard/AttentionPanel';
import { BestSellers } from '@/components/dashboard/BestSellers';
import { RecentOrders } from '@/components/dashboard/RecentOrders';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [newOrders, setNewOrders] = useState<MarketOrder[]>([]);
  const [outOfStock, setOutOfStock] = useState<Product[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      // The dashboard payload carries only a *count* of out-of-stock items, so
      // the product list is fetched too — the attention panel needs names to
      // be actionable, and this is the same endpoint the catalog page uses.
      const [dashRes, ordersRes, productsRes] = await Promise.all([
        marketApi.getDashboard(),
        marketApi.getOrders('new'),
        marketApi.getProducts(),
      ]);
      setData(dashRes.data.data);
      setNewOrders(ordersRes.data.data);
      setOutOfStock(productsRes.data.data.filter((p) => p.stock === 0));
      setStatus('ready');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : null);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        <SkeletonStats />
        <Skeleton className="h-56 rounded-xl" />
        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (status === 'error' || !data) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Bugungi buyurtmalar"
          value={formatNumber(data.todayOrdersCount)}
          icon={<ClipboardList size={18} />}
          tone="mint"
        />
        <StatCard
          label="Bugungi tushum"
          value={formatMoney(data.todayRevenue)}
          icon={<Wallet size={18} />}
          tone="mint"
          compactValue
        />
        <StatCard
          label="Kutilayotgan buyurtmalar"
          value={formatNumber(newOrders.length)}
          icon={<ClipboardList size={18} />}
          tone={newOrders.length > 0 ? 'mint' : 'neutral'}
          live={newOrders.length > 0}
          hint={newOrders.length > 0 ? "Javob kutmoqda" : 'Javobsiz buyurtma yo‘q'}
        />
        <StatCard
          label="Zaxirasi kam mahsulotlar"
          value={formatNumber(data.lowStock.length)}
          icon={<Boxes size={18} />}
          tone={data.lowStock.length > 0 ? 'warn' : 'neutral'}
          hint={
            data.outOfStockCount > 0 ? `${data.outOfStockCount} ta butunlay tugagan` : undefined
          }
        />
      </div>

      <AttentionPanel outOfStock={outOfStock} lowStock={data.lowStock} newOrders={newOrders} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
        <RecentOrders orders={data.recentOrders} />
        <BestSellers items={data.bestSellers} />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Faol mahsulotlar"
          value={formatNumber(data.activeProductsCount)}
          icon={<Boxes size={18} />}
        />
        <StatCard
          label="Yashirilgan mahsulotlar"
          value={formatNumber(data.hiddenProductsCount)}
          icon={<Boxes size={18} />}
        />
        <StatCard
          label="Zaxira tugagan"
          value={formatNumber(data.outOfStockCount)}
          icon={<PackageX size={18} />}
          tone={data.outOfStockCount > 0 ? 'danger' : 'neutral'}
        />
        <StatCard
          label="Kam zaxira chegarasi"
          value={formatNumber(data.lowStockThreshold)}
          icon={<Boxes size={18} />}
          hint="Sozlamalarda o‘zgartiriladi"
        />
      </div>
    </div>
  );
}
