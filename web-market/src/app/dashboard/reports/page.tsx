'use client';

import { useMemo } from 'react';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { marketApi, ReportsData } from '@/lib/api';
import { downloadCsv, money, moneyShort } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataErrorBanner } from '@/components/ui/DataErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';

export default function ReportsPage() {
  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<ReportsData>(async () => {
    const res = await marketApi.getReports();
    return res.data.data;
  });

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
        description="Savdo tahlili va statistika"
        icon={<BarChart3 size={18} aria-hidden />}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void reload()}
              isLoading={isRefreshing}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              Yangilash
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={exportCsv}
              disabled={!data}
              leftIcon={<Download size={13} aria-hidden />}
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[74px] rounded-ds-md" />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Skeleton className="h-72 rounded-ds-md" />
            <Skeleton className="h-72 rounded-ds-md" />
          </div>
          <Skeleton className="h-64 rounded-ds-md" />
        </div>
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <ReportsBody data={data} />
      ) : null}
    </div>
  );
}

function ReportsBody({ data }: { data: ReportsData }) {
  const maxRevenue = Math.max(...data.weeklyRevenue.map((d) => d.total), 1);

  // Davr xulosasi — FAQAT real ma'lumotdan hisoblanadi. API o'tgan hafta
  // bilan solishtirishni bermaydi, shuning uchun "o'tgan haftaga nisbatan"
  // ko'rsatkichi YO'Q — o'ylab topilgan foiz eng qimmat yolg'on bo'lar edi.
  const summary = useMemo(() => {
    const weekTotal = data.weeklyRevenue.reduce((s, d) => s + d.total, 0);
    const days = data.weeklyRevenue.length || 1;
    const best = data.weeklyRevenue.reduce(
      (acc, d) => (d.total > acc.total ? d : acc),
      data.weeklyRevenue[0] ?? { day: '—', total: 0 }
    );
    return { weekTotal, avgPerDay: Math.round(weekTotal / days), best };
  }, [data.weeklyRevenue]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Haftalik tushum" value={moneyShort(summary.weekTotal)} hint="so'm" tone="mint" />
        <StatTile
          label="O'rtacha kunlik"
          value={moneyShort(summary.avgPerDay)}
          hint="so'm / kun"
          tone="neutral"
        />
        <StatTile
          label="Eng yaxshi kun"
          value={summary.best.day}
          hint={`${moneyShort(summary.best.total)} so'm`}
          tone="neutral"
        />
        <StatTile
          label="Zaxira aylanishi"
          value={`${data.stockTurnover}×`}
          hint="joriy zaxiraga nisbatan"
          tone="neutral"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card padding="lg">
          <CardHeader>
            <div>
              <CardTitle>Haftalik tushum</CardTitle>
              <p className="mt-1 font-mono text-h1 tabular-nums text-ink">
                {money(summary.weekTotal)}
              </p>
            </div>
          </CardHeader>

          {data.weeklyRevenue.length === 0 ? (
            <EmptyState
              compact
              title="Hali ma'lumot yo'q"
              description="Birinchi sotuvdan keyin grafik shakllanadi."
            />
          ) : (
            // A table for screen readers, a bar chart for everyone else — the
            // bar heights alone convey nothing without the numbers.
            <>
              <div className="flex h-40 items-end gap-3 pt-2" aria-hidden>
                {data.weeklyRevenue.map((d, i) => (
                  <div
                    key={i}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                    title={`${d.day}: ${money(d.total)}`}
                  >
                    <div
                      className={clsx(
                        'w-full max-w-[34px] rounded-t-ds-xs',
                        d.total === summary.best.total && d.total > 0
                          ? 'bg-primary'
                          : 'bg-mint-deep/70'
                      )}
                      style={{ height: `${Math.max(4, Math.round((d.total / maxRevenue) * 100))}%` }}
                    />
                    <span className="text-caption text-muted">{d.day}</span>
                  </div>
                ))}
              </div>
              <table className="sr-only">
                <caption>Haftalik tushum</caption>
                <tbody>
                  {data.weeklyRevenue.map((d, i) => (
                    <tr key={i}>
                      <th scope="row">{d.day}</th>
                      <td>{money(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>

        {/* Donut emas — gorizontal chiziqlar: miqdor UZUNLIK bilan kodlanadi,
            burchak/yuza bilan emas (operatsion panel qoidasi). */}
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Kategoriya bo&apos;yicha</CardTitle>
          </CardHeader>
          {data.categoryBreakdown.length === 0 ? (
            <EmptyState compact title="Hali ma'lumot yo'q" />
          ) : (
            <ul className="space-y-3">
              {data.categoryBreakdown.map((c) => (
                <li key={c.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-caption font-semibold text-ink">
                      {c.name}
                    </span>
                    <span className="shrink-0 font-mono text-caption tabular-nums text-muted">
                      {moneyShort(c.total)} so&apos;m
                    </span>
                    <span className="w-10 shrink-0 text-right font-mono text-caption tabular-nums font-bold text-ink">
                      {c.pct}%
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={c.pct}
                    aria-label={`${c.name}: ${c.pct}%`}
                  >
                    <div
                      className="h-full rounded-full bg-mint-deep"
                      style={{ width: `${Math.min(100, c.pct)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card padding="lg" className="max-w-2xl">
        <CardHeader>
          <CardTitle>Eng ko&apos;p sotilganlar</CardTitle>
        </CardHeader>
        {data.bestSellers.length === 0 ? (
          <EmptyState compact title="Hali ma'lumot yo'q" />
        ) : (
          <ul className="space-y-3.5">
            {data.bestSellers.map((b, i) => {
              const max = data.bestSellers[0]?.sold || 1;
              const pct = Math.round((b.sold / max) * 100);
              return (
                <li key={b.name} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ds-xs bg-mint-tint font-mono text-caption tabular-nums font-bold text-primary-text">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-caption font-semibold text-ink">{b.name}</p>
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                      aria-label={`${b.name}: ${b.sold} dona`}
                    >
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-caption tabular-nums font-bold text-muted">
                    {b.sold}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
