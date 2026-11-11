'use client';

import { useCallback, useMemo, useState } from 'react';
import { Download, Inbox } from 'lucide-react';
import { foodApi, ReportsData } from '@/lib/api';
import { useAsyncData } from '@/hooks/useAsyncData';
import { formatMoney, formatNumber } from '@/lib/format';
import { usePageRefresh } from '@/components/shell';
import { BarChart, type BarDatum } from '@/components/reports/BarChart';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SkeletonCards, SkeletonStats } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { t } from '@/locales';

type Range = '7' | '30';

const RANGE_VALUES: readonly Range[] = ['7', '30'];

/** Backend kun qisqartmasi ("Du") → faol tildagi yozuv; tanilmasa — o'zi. */
function dayLabel(day: string): string {
  return t().reports.weekdaysShort[day] ?? day;
}

/** Y o'qi uchun ixcham pul: 1 200 000 → "1.2 mln", 45 000 → "45 ming". */
function compactMoney(v: number): string {
  const m = t().reports;
  if (v >= 1_000_000) return m.million(formatNumber(v / 1_000_000, v % 1_000_000 === 0 ? 0 : 1));
  if (v >= 1_000) return m.thousand(formatNumber(v / 1_000));
  return formatNumber(v);
}

/**
 * Davr ichidagi taqqoslash FAQAT yuklangan real ma'lumotdan: davrning
 * ikkinchi yarmi kunlik o'rtachasi birinchi yarmiga nisbatan. API o'tgan
 * davrni bermaydi — shuning uchun StatCard delta'si EMAS, grafik izohi.
 */
function halfPeriodDelta(revenue: ReportsData['revenue']) {
  if (revenue.length < 4) return null;
  const half = Math.floor(revenue.length / 2);
  const avg = (arr: ReportsData['revenue']) => arr.reduce((s, r) => s + r.total, 0) / arr.length;
  const a1 = avg(revenue.slice(0, half));
  const a2 = avg(revenue.slice(half));
  if (a1 <= 0) return null;
  return { pct: Math.round(((a2 - a1) / a1) * 100), firstDays: half, secondDays: revenue.length - half };
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(data: ReportsData, range: Range) {
  const c = t().reports.csv;
  const lines: string[] = [];
  lines.push(c.dailyRevenue);
  lines.push(c.dailyHeader);
  data.revenue.forEach((r) => lines.push(`${csvCell(dayLabel(r.day))},${Math.round(r.total)}`));
  lines.push('');
  lines.push(c.topDishes);
  lines.push(c.topHeader);
  data.topDishes.forEach((t) => lines.push(`${csvCell(t.name)},${t.qty}`));
  lines.push('');
  lines.push(c.hourly);
  lines.push(c.hourlyHeader);
  data.hourly.forEach((h) => lines.push(`${h.hour}:00,${h.count}`));
  lines.push('');
  lines.push(c.payout);
  lines.push(`${csvCell(c.gross)},${Math.round(data.payout.gross)}`);
  lines.push(`${csvCell(c.commission(data.payout.commissionRate))},${Math.round(data.payout.commission)}`);
  lines.push(`${csvCell(c.net)},${Math.round(data.payout.net)}`);
  lines.push(`${csvCell(c.orders)},${data.payout.orders}`);

  // BOM — Excel UTF-8 ni to'g'ri ochishi uchun.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = c.fileName(range, new Date().toISOString().slice(0, 10));
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const m = t();
  const rm = m.reports;
  const ranges = RANGE_VALUES.map((value) => ({ value, label: rm.range(value) }));
  const [range, setRange] = useState<Range>('7');

  const load = useCallback(async (): Promise<ReportsData> => {
    const res = await foodApi.getReports(Number(range) as 7 | 30);
    return res.data.data;
  }, [range]);

  const { data, status, error, reload } = useAsyncData<ReportsData>(load);
  usePageRefresh(reload);

  const delta = useMemo(() => (data ? halfPeriodDelta(data.revenue) : null), [data]);

  const revenueBars: BarDatum[] = useMemo(() => {
    const rows = data?.revenue ?? [];
    // 30 kunda har kun yozuvi sig'maydi — har 5-kun va oxirgisi.
    const every = rows.length > 10 ? 5 : 1;
    return rows.map((r, i) => ({
      // Kun nomlari takrorlanadi (30 kunda 4 ta "Du") — kalit indeks bilan.
      key: `d${i}`,
      label: i % every === 0 || i === rows.length - 1 ? dayLabel(r.day) : '',
      value: r.total,
      title: rm.revenueBarTitle(dayLabel(r.day), formatMoney(r.total)),
    }));
  }, [data, rm]);

  const peakHour = useMemo(() => {
    const hourly = data?.hourly ?? [];
    const best = hourly.reduce<ReportsData['hourly'][number] | null>(
      (acc, h) => (h.count > (acc?.count ?? 0) ? h : acc),
      null
    );
    return best;
  }, [data]);

  const hourlyBars: BarDatum[] = useMemo(
    () =>
      (data?.hourly ?? []).map((h) => ({
        key: `h${h.hour}`,
        label: h.hour % 3 === 0 ? String(h.hour) : '',
        value: h.count,
        title: rm.hourBarTitle(h.hour, formatNumber(h.count)),
      })),
    [data, rm]
  );

  const maxDish = data?.topDishes[0]?.qty || 1;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={rm.title}
        description={rm.description}
        actions={
          <>
            <SegmentedControl items={ranges} value={range} onChange={setRange} label={rm.rangeLabel} />
            <Button
              variant="secondary"
              leftIcon={<Download size={14} />}
              disabled={!data}
              onClick={() => data && exportCsv(data, range)}
            >
              {rm.downloadCsv}
            </Button>
          </>
        }
      />

      {status === 'loading' && (
        <div className="flex flex-col gap-5">
          <SkeletonStats count={4} />
          <SkeletonCards count={2} height="h-64" columns />
        </div>
      )}

      {status === 'error' && <ErrorState title={rm.loadFailed} message={error} onRetry={reload} />}

      {status === 'ready' && data && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={rm.grossRevenue} value={formatMoney(data.payout.gross, { currency: false })} unit={m.common.som} />
            <StatCard
              label={rm.commission(data.payout.commissionRate)}
              value={formatMoney(data.payout.commission, { currency: false })}
              unit={m.common.som}
              hint={rm.platformShare}
            />
            <StatCard
              label={rm.netPayout}
              value={formatMoney(data.payout.net, { currency: false })}
              unit={m.common.som}
              hint={rm.paidToYou}
            />
            <StatCard label={rm.orders} value={formatNumber(data.payout.orders)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card padding="none">
              <CardHeader
                title={rm.dailyRevenue}
                description={
                  delta
                    ? rm.deltaDescription(delta.secondDays, delta.firstDays, `${delta.pct >= 0 ? '+' : ''}${delta.pct}`)
                    : rm.lastDays(range)
                }
              />
              <CardBody>
                <BarChart
                  data={revenueBars}
                  formatTick={compactMoney}
                  ariaLabel={rm.lastDaysRevenueAria(range)}
                />
              </CardBody>
            </Card>

            <Card padding="none">
              <CardHeader title={rm.topDishes} description={rm.byUnits} />
              <CardBody>
                {data.topDishes.length === 0 ? (
                  <EmptyState
                    compact
                    variant="first-use"
                    icon={<Inbox size={20} />}
                    title={rm.noDataTitle}
                    description={rm.noDataDescription}
                  />
                ) : (
                  <ol className="flex flex-col gap-3">
                    {data.topDishes.map((t, i) => (
                      <li key={`${t.name}-${i}`}>
                        <div className="mb-1 flex justify-between gap-3 text-[13px]">
                          <span className="truncate font-medium text-ink">{t.name}</span>
                          <span className="num text-muted">{m.common.count(formatNumber(t.qty))}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${Math.max(2, (t.qty / maxDish) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>
          </div>

          <Card padding="none">
            <CardHeader
              title={rm.hourlyLoad}
              description={
                peakHour ? rm.peakHour(peakHour.hour, formatNumber(peakHour.count)) : rm.ordersCount
              }
            />
            <CardBody>
              <BarChart
                data={hourlyBars}
                formatTick={(v) => formatNumber(v, Number.isInteger(v) ? 0 : 1)}
                highlightKey={peakHour ? `h${peakHour.hour}` : null}
                heightClassName="h-40"
                ariaLabel={rm.hourlyAria}
              />
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
