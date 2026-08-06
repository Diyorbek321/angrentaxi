'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, PieChart, Repeat, TrendingUp } from 'lucide-react';
import { marketApi, type ReportsData } from '@/lib/api';
import { formatMoney, formatNumber } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonStats } from '@/components/ui/Skeleton';
import { BestSellers } from '@/components/dashboard/BestSellers';
import { RevenueChart } from '@/components/reports/RevenueChart';
import { CategoryBars } from '@/components/reports/CategoryBars';

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const res = await marketApi.getReports();
      setData(res.data.data);
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

  const exportCsv = () => {
    if (!data) return;
    const rows: Array<Array<string | number>> = [
      ['Haftalik tushum'],
      ['Kun', "Tushum (so'm)"],
      ...data.weeklyRevenue.map((d) => [d.day, Math.round(d.total)]),
      [],
      ['Kategoriyalar bo‘yicha taqsimot'],
      ['Kategoriya', "Summa (so'm)", 'Ulush (%)'],
      ...data.categoryBreakdown.map((c) => [c.name, Math.round(c.total), c.pct]),
      [],
      ['Eng ko‘p sotilgan'],
      ['Mahsulot', 'Sotilgan'],
      ...data.bestSellers.map((b) => [b.name, b.sold]),
      [],
      ['Zaxira aylanishi', data.stockTurnover],
    ];
    downloadCsv('angren-market-hisobot.csv', rows);
  };

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        <SkeletonStats count={2} />
        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (status === 'error' || !data) return <ErrorState message={error} onRetry={load} />;

  const weekTotal = data.weeklyRevenue.reduce((sum, d) => sum + d.total, 0);
  const bestDay = data.weeklyRevenue.reduce(
    (best, d) => (d.total > best.total ? d : best),
    data.weeklyRevenue[0] ?? { day: '—', total: 0 }
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">So&apos;nggi 7 kun bo&apos;yicha</p>
        <Button variant="secondary" onClick={exportCsv} leftIcon={<Download size={15} />}>
          CSV yuklab olish
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Haftalik tushum"
          value={formatMoney(weekTotal)}
          icon={<TrendingUp size={18} />}
          tone="mint"
          compactValue
        />
        <StatCard
          label="Eng savdoli kun"
          value={bestDay.day}
          icon={<TrendingUp size={18} />}
          hint={formatMoney(bestDay.total)}
          compactValue
        />
        <StatCard
          label="Zaxira aylanishi"
          value={`${formatNumber(data.stockTurnover)}×`}
          icon={<Repeat size={18} />}
          hint="Sotilgan / joriy zaxira"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
        <Card>
          <CardHeader
            title="Haftalik tushum"
            subtitle="Kunlik savdo, so'mda"
            icon={<TrendingUp size={16} />}
          />
          <RevenueChart data={data.weeklyRevenue} />
        </Card>

        <Card>
          <CardHeader
            title="Kategoriyalar bo'yicha"
            subtitle="Savdoning kategoriyalar kesimi"
            icon={<PieChart size={16} />}
          />
          <CategoryBars data={data.categoryBreakdown} />
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <BestSellers items={data.bestSellers} />
      </div>
    </div>
  );
}
