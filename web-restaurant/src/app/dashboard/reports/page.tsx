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

type Range = '7' | '30';

const RANGES: { value: Range; label: string }[] = [
  { value: '7', label: '7 kun' },
  { value: '30', label: '30 kun' },
];

/** Y o'qi uchun ixcham pul: 1 200 000 → "1.2 mln", 45 000 → "45 ming". */
function compactMoney(v: number): string {
  if (v >= 1_000_000) return `${formatNumber(v / 1_000_000, v % 1_000_000 === 0 ? 0 : 1)} mln`;
  if (v >= 1_000) return `${formatNumber(v / 1_000)} ming`;
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
  const lines: string[] = [];
  lines.push('Kunlik tushum');
  lines.push("Kun,Tushum (so'm)");
  data.revenue.forEach((r) => lines.push(`${csvCell(r.day)},${Math.round(r.total)}`));
  lines.push('');
  lines.push("Eng ko'p sotilgan taomlar");
  lines.push('Taom,Soni');
  data.topDishes.forEach((t) => lines.push(`${csvCell(t.name)},${t.qty}`));
  lines.push('');
  lines.push("Soatlar bo'yicha yuklama");
  lines.push('Soat,Buyurtmalar');
  data.hourly.forEach((h) => lines.push(`${h.hour}:00,${h.count}`));
  lines.push('');
  lines.push("To'lov xulosasi");
  lines.push(`Jami tushum,${Math.round(data.payout.gross)}`);
  lines.push(`Komissiya (${data.payout.commissionRate}%),${Math.round(data.payout.commission)}`);
  lines.push(`Sof to'lov,${Math.round(data.payout.net)}`);
  lines.push(`Buyurtmalar,${data.payout.orders}`);

  // BOM — Excel UTF-8 ni to'g'ri ochishi uchun.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hisobot-${range}kun-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
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
      label: i % every === 0 || i === rows.length - 1 ? r.day : '',
      value: r.total,
      title: `${r.day}: ${formatMoney(r.total)}`,
    }));
  }, [data]);

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
        title: `${h.hour}:00 — ${formatNumber(h.count)} ta buyurtma`,
      })),
    [data]
  );

  const maxDish = data?.topDishes[0]?.qty || 1;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Hisobotlar"
        description="Tushum, ommabop taomlar va soatlik yuklama"
        actions={
          <>
            <SegmentedControl items={RANGES} value={range} onChange={setRange} label="Hisobot davri" />
            <Button
              variant="secondary"
              leftIcon={<Download size={14} />}
              disabled={!data}
              onClick={() => data && exportCsv(data, range)}
            >
              CSV yuklab olish
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

      {status === 'error' && <ErrorState title="Hisobotni yuklab boʻlmadi" message={error} onRetry={reload} />}

      {status === 'ready' && data && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Jami tushum" value={formatMoney(data.payout.gross, { currency: false })} unit="soʻm" />
            <StatCard
              label={`Komissiya (${data.payout.commissionRate}%)`}
              value={formatMoney(data.payout.commission, { currency: false })}
              unit="soʻm"
              hint="Platforma ulushi"
            />
            <StatCard
              label="Sof toʻlov"
              value={formatMoney(data.payout.net, { currency: false })}
              unit="soʻm"
              hint="Sizga oʻtkaziladi"
            />
            <StatCard label="Buyurtmalar" value={formatNumber(data.payout.orders)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card padding="none">
              <CardHeader
                title="Kunlik tushum"
                description={
                  delta
                    ? `Oxirgi ${delta.secondDays} kun kunlik oʻrtachasi avvalgi ${delta.firstDays} kunga nisbatan ${
                        delta.pct >= 0 ? '+' : ''
                      }${delta.pct}%`
                    : `Soʻnggi ${range} kun`
                }
              />
              <CardBody>
                <BarChart
                  data={revenueBars}
                  formatTick={compactMoney}
                  ariaLabel={`Soʻnggi ${range} kunlik tushum`}
                />
              </CardBody>
            </Card>

            <Card padding="none">
              <CardHeader title="Eng koʻp sotilgan taomlar" description="Dona boʻyicha" />
              <CardBody>
                {data.topDishes.length === 0 ? (
                  <EmptyState
                    compact
                    variant="first-use"
                    icon={<Inbox size={20} />}
                    title="Maʼlumot yigʻilmagan"
                    description="Kamida bitta yakunlangan buyurtma kerak."
                  />
                ) : (
                  <ol className="flex flex-col gap-3">
                    {data.topDishes.map((t, i) => (
                      <li key={`${t.name}-${i}`}>
                        <div className="mb-1 flex justify-between gap-3 text-[13px]">
                          <span className="truncate font-medium text-ink">{t.name}</span>
                          <span className="num text-muted">{formatNumber(t.qty)} ta</span>
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
              title="Soatlar boʻyicha yuklama"
              description={
                peakHour ? `Eng band soat: ${peakHour.hour}:00 — ${formatNumber(peakHour.count)} ta buyurtma` : 'Buyurtmalar soni'
              }
            />
            <CardBody>
              <BarChart
                data={hourlyBars}
                formatTick={(v) => formatNumber(v, Number.isInteger(v) ? 0 : 1)}
                highlightKey={peakHour ? `h${peakHour.hour}` : null}
                heightClassName="h-40"
                ariaLabel="Soatlar boʻyicha buyurtmalar soni"
              />
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
