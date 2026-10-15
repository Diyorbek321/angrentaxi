'use client';

import { useMemo } from 'react';
import { Download, PieChart, RefreshCw, Trophy } from 'lucide-react';
import { marketApi, ReportsData } from '@/lib/api';
import { downloadCsv } from '@/lib/utils';
import { formatMoney, formatNumber } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { RankedBars } from '@/components/charts/RankedBars';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataErrorBanner } from '@/components/ui/DataErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton, SkeletonStats } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { usePageRefresh } from '@/components/shell';

export default function ReportsPage() {
  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<ReportsData>(async () => {
    const res = await marketApi.getReports();
    return res.data.data;
  });
  usePageRefresh(reload);

  const exportCsv = () => {
    if (!data) return;
    const rows: Array<Array<string | number>> = [
      ['Haftalik tushum'],
      ['Kun', "Tushum (so'm)"],
      ...data.weeklyRevenue.map((d) => [d.day, d.total]),
      [],
      ['Kategoriya bo‘yicha taqsimot'],
      ['Kategoriya', "Tushum (so'm)", 'Ulush (%)'],
      ...data.categoryBreakdown.map((c) => [c.name, c.total, c.pct]),
      [],
      ['Eng ko‘p sotilganlar'],
      ['Mahsulot', 'Sotilgan (dona)'],
      ...data.bestSellers.map((b) => [b.name, b.sold]),
      [],
      ['Zaxira aylanishi', data.stockTurnover],
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`angren-market-hisobot-${stamp}.csv`, rows);
  };

  return (
    <div>
      <PageHeader
        title="Hisobotlar"
        description="Oxirgi 7 kunlik savdo tahlili"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void reload()}
              isLoading={isRefreshing}
              leftIcon={<RefreshCw size={14} aria-hidden />}
            >
              Yangilash
            </Button>
            <Button
              variant="secondary"
              onClick={exportCsv}
              disabled={!data}
              leftIcon={<Download size={14} aria-hidden />}
            >
              CSV yuklab olish
            </Button>
          </>
        }
      />

      {error && data && <DataErrorBanner message={error} onRetry={reload} retrying={isRefreshing} />}

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <span className="sr-only">Yuklanmoqda</span>
          <SkeletonStats count={4} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Skeleton className="h-72 rounded-ds-md" />
            <Skeleton className="h-72 rounded-ds-md" />
          </div>
          <Skeleton className="h-64 rounded-ds-md" />
        </div>
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} retrying={isRefreshing} />
      ) : data ? (
        <ReportsBody data={data} />
      ) : null}
    </div>
  );
}

function ReportsBody({ data }: { data: ReportsData }) {
  // Davr xulosasi — FAQAT real ma'lumotdan. API o'tgan hafta bilan
  // solishtirishni bermaydi, shuning uchun delta YO'Q.
  const summary = useMemo(() => {
    const weekTotal = data.weeklyRevenue.reduce((s, d) => s + d.total, 0);
    const days = data.weeklyRevenue.length || 1;
    const best = data.weeklyRevenue.reduce<{ day: string; total: number } | null>(
      (acc, d) => (!acc || d.total > acc.total ? d : acc),
      null
    );
    return { weekTotal, avgPerDay: Math.round(weekTotal / days), best };
  }, [data.weeklyRevenue]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Haftalik tushum" value={formatNumber(summary.weekTotal)} unit="soʻm" />
        <StatCard label="Oʻrtacha kunlik" value={formatNumber(summary.avgPerDay)} unit="soʻm" />
        <StatCard
          label="Eng yaxshi kun"
          value={summary.best && summary.best.total > 0 ? summary.best.day : '—'}
          hint={summary.best && summary.best.total > 0 ? formatMoney(summary.best.total) : 'Hali sotuv yoʻq'}
        />
        <StatCard
          label="Zaxira aylanishi"
          value={`${formatNumber(data.stockTurnover, data.stockTurnover % 1 === 0 ? 0 : 1)}×`}
          hint="Joriy zaxiraga nisbatan"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card padding="none">
          <CardHeader title="Kunlik tushum" description={`Jami ${formatMoney(summary.weekTotal)}`} />
          <div className="px-4 pb-4 pt-2">
            <ColumnChart
              ariaLabel="Kunlik tushum"
              data={data.weeklyRevenue.map((d) => ({ label: d.day, value: d.total }))}
            />
          </div>
        </Card>

        <Card padding="none">
          <CardHeader title="Kategoriya boʻyicha" description="Tushum ulushi" />
          <div className="px-4 pb-4">
            {data.categoryBreakdown.length === 0 ? (
              <EmptyState
                compact
                icon={<PieChart aria-hidden />}
                title="Hali maʼlumot yoʻq"
                description="Sotuv boshlangach kategoriyalar ulushi shu yerda chiqadi."
              />
            ) : (
              <RankedBars
                ariaLabel="Kategoriya boʻyicha tushum"
                items={data.categoryBreakdown.map((c) => ({
                  label: c.name,
                  value: c.total,
                  display: `${formatMoney(c.total)} · ${formatNumber(c.pct)}%`,
                }))}
              />
            )}
          </div>
        </Card>
      </div>

      <Card padding="none" className="max-w-3xl">
        <CardHeader title="Eng koʻp sotilganlar" description="Dona hisobida" />
        <div className="px-4 pb-4">
          {data.bestSellers.length === 0 ? (
            <EmptyState
              compact
              icon={<Trophy aria-hidden />}
              title="Hali sotuv yoʻq"
              description="Birinchi sotuvdan keyin reyting shakllanadi."
            />
          ) : (
            <RankedBars
              ariaLabel="Eng koʻp sotilgan mahsulotlar"
              unit="dona"
              items={data.bestSellers.map((b) => ({ label: b.name, value: b.sold }))}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
