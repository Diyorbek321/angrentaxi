'use client';

import { BarChart3, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { marketApi, ReportsData } from '@/lib/api';
import { money } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Categorical chart palette, taken from the semantic token set rather than
 * invented per screen. Every entry clears 3:1 against both the light and the
 * dark surface, which plain `mint` (2.12:1) would not — so the accent layer is
 * represented here by `mint-deep`.
 */
const PALETTE = ['#10A064', '#3B82F6', '#8B5CF6', '#F59E0B', '#E5484D', '#0C7A4D'];

export default function ReportsPage() {
  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<ReportsData>(async () => {
    const res = await marketApi.getReports();
    return res.data.data;
  });

  return (
    <div>
      <PageHeader
        title="Hisobotlar"
        description="Savdo tahlili va statistika"
        icon={<BarChart3 size={18} aria-hidden />}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void reload()}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw size={13} aria-hidden />}
          >
            Yangilash
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <span className="sr-only">Yuklanmoqda</span>
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Skeleton className="h-72 rounded-ds-md" />
            <Skeleton className="h-72 rounded-ds-md" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-ds-md" />
            <Skeleton className="h-64 rounded-ds-md" />
          </div>
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
  const weekTotal = data.weeklyRevenue.reduce((s, d) => s + d.total, 0);
  const lastIndex = data.weeklyRevenue.length - 1;

  let cumulative = 0;
  const donutStops = data.categoryBreakdown.map((c, i) => {
    const from = cumulative;
    cumulative += c.pct;
    return `${PALETTE[i % PALETTE.length]} ${from}% ${cumulative}%`;
  });
  const donut = donutStops.length
    ? `conic-gradient(${donutStops.join(',')})`
    : 'rgb(var(--surface-3))';

  const turnoverPct = Math.min(100, Math.round(data.stockTurnover * 10));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card padding="lg">
          <CardHeader>
            <div>
              <CardTitle>Haftalik tushum</CardTitle>
              <p className="mt-1 font-mono text-h1 text-ink">{money(weekTotal)}</p>
            </div>
          </CardHeader>

          {data.weeklyRevenue.length === 0 ? (
            <EmptyState compact title="Hali ma'lumot yo'q" />
          ) : (
            // A table for screen readers, a bar chart for everyone else — the
            // bar heights alone convey nothing without the numbers.
            <>
              <div className="flex h-40 items-end gap-3 pt-2" aria-hidden>
                {data.weeklyRevenue.map((d, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <div
                      className={clsx(
                        'w-full max-w-[34px] rounded-t-ds-xs',
                        i === lastIndex ? 'bg-primary' : 'bg-mint-deep/70'
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

        <Card padding="lg">
          <CardHeader>
            <CardTitle>Kategoriya bo&apos;yicha</CardTitle>
          </CardHeader>
          {data.categoryBreakdown.length === 0 ? (
            <EmptyState compact title="Hali ma'lumot yo'q" />
          ) : (
            <div className="flex flex-wrap items-center gap-5">
              <div
                aria-hidden
                className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-full"
                style={{ background: donut }}
              >
                <div className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full bg-surface">
                  <span className="font-mono text-h3 text-ink">{data.categoryBreakdown.length}</span>
                  <span className="text-[10px] font-semibold text-muted">kategoriya</span>
                </div>
              </div>
              <ul className="min-w-[160px] flex-1 space-y-2.5">
                {data.categoryBreakdown.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ background: PALETTE[i % PALETTE.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-caption font-semibold text-ink">
                      {c.name}
                    </span>
                    <span className="font-mono text-caption font-bold text-muted">{c.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="lg">
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
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ds-xs bg-mint-tint font-mono text-caption font-bold text-primary-text">
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
                    <span className="shrink-0 font-mono text-caption font-bold text-muted">
                      {b.sold}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card padding="lg" className="flex flex-col items-center justify-center text-center">
          <p className="text-caption font-semibold text-muted">Zaxira aylanishi</p>
          <div
            aria-hidden
            className="my-4 flex h-[130px] w-[130px] items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#0C7A4D 0% ${turnoverPct}%, rgb(var(--surface-3)) ${turnoverPct}% 100%)`,
            }}
          >
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-surface">
              <span className="font-mono text-h1 text-primary-text">{data.stockTurnover}×</span>
              <span className="text-[10px] font-semibold text-muted">jami</span>
            </div>
          </div>
          <p className="max-w-[220px] text-caption text-muted">
            Har bir mahsulot o&apos;rtacha {data.stockTurnover}× sotilgan — joriy zaxiraga
            nisbatan.
          </p>
        </Card>
      </div>
    </div>
  );
}
