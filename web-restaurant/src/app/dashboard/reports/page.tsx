'use client';

import { useCallback, useMemo, useState } from 'react';
import { BarChart3, Download, Inbox, TrendingDown, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { foodApi, ReportsData } from '@/lib/api';
import { useAsyncData } from '@/hooks/useAsyncData';
import { money } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonCards, SkeletonStats } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { Tabs } from '@/components/ui/Tabs';

const RANGES = [
  { value: '7', label: '7 kun' },
  { value: '30', label: '30 kun' },
] as const;

/**
 * Davr taqqoslashi FAQAT yuklangan real ma'lumotdan: davrning ikkinchi
 * yarmi kunlik o'rtachasi birinchi yarmiga nisbatan. API o'tgan davrni
 * alohida bermaydi — o'ylab topilgan delta bo'lmaydi.
 */
function halfPeriodDelta(revenue: ReportsData['revenue']): {
  pct: number;
  firstDays: number;
  secondDays: number;
} | null {
  if (revenue.length < 4) return null;
  const half = Math.floor(revenue.length / 2);
  const first = revenue.slice(0, half);
  const second = revenue.slice(half);
  const avg = (arr: ReportsData['revenue']) =>
    arr.length ? arr.reduce((s, r) => s + r.total, 0) / arr.length : 0;
  const a1 = avg(first);
  const a2 = avg(second);
  if (a1 <= 0) return null;
  return { pct: Math.round(((a2 - a1) / a1) * 100), firstDays: first.length, secondDays: second.length };
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ReportsPage() {
  const [range, setRange] = useState<'7' | '30'>('7');

  const load = useCallback(async (): Promise<ReportsData> => {
    const res = await foodApi.getReports(Number(range) as 7 | 30);
    return res.data.data;
  }, [range]);

  const { data, status, error, reload } = useAsyncData<ReportsData>(load);

  const maxRevenue = Math.max(...(data?.revenue.map((r) => r.total) ?? [0]), 1);
  const maxHourly = Math.max(...(data?.hourly.map((h) => h.count) ?? [0]), 1);
  const peakHour = data?.hourly.reduce((best, h) => (h.count > best.count ? h : best), data.hourly[0]);
  const maxDish = data?.topDishes[0]?.qty || 1;
  const hasRevenue = (data?.revenue ?? []).some((r) => r.total > 0);
  const delta = useMemo(() => (data ? halfPeriodDelta(data.revenue) : null), [data]);

  /** CSV — klient tomonda, yuklangan ma'lumotdan. Operatorning universal chiqish yo'li. */
  const exportCsv = () => {
    if (!data) return;
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
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hisobot-${range}kun-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Hisobotlar"
        description="Tushum, ommabop taomlar va yuklama"
        icon={<BarChart3 size={20} />}
        actions={
          <>
            <Tabs
              items={RANGES}
              value={range}
              onChange={(v) => setRange(v)}
              label="Hisobot davri"
              size="sm"
            />
            <Button
              variant="secondary"
              leftIcon={<Download size={14} />}
              disabled={!data}
              onClick={exportCsv}
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

      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' && data && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Jami tushum" value={money(data.payout.gross)} tone="neutral" />
            <StatTile
              label={`Komissiya (${data.payout.commissionRate}%)`}
              value={`−${money(data.payout.commission)}`}
              tone="danger"
            />
            <StatTile label="Sof to'lov" value={money(data.payout.net)} tone="mint" />
            <StatTile label="Buyurtmalar" value={data.payout.orders} tone="info" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Tushum dinamikasi</CardTitle>
                <span className="text-caption text-muted">so&apos;nggi {range} kun</span>
              </CardHeader>

              {/* Davr taqqoslashi — faqat yuklangan real ma'lumotdan (yarmga
                  yarim, kunlik o'rtacha). Yo'nalish rang + strelka + yozuv
                  bilan — rang yolg'iz ma'no tashimaydi. */}
              {delta && hasRevenue && (
                <p
                  className={clsx(
                    'mb-3 -mt-1 inline-flex items-center gap-1.5 text-caption font-semibold',
                    delta.pct >= 0 ? 'text-primary-text' : 'text-danger-deep dark:text-danger-light'
                  )}
                >
                  {delta.pct >= 0 ? (
                    <TrendingUp size={14} aria-hidden />
                  ) : (
                    <TrendingDown size={14} aria-hidden />
                  )}
                  <span className="font-mono tabular-nums">
                    {delta.pct >= 0 ? '+' : ''}
                    {delta.pct}%
                  </span>
                  <span className="font-medium text-muted">
                    oxirgi {delta.secondDays} kun kunlik o&apos;rtachasi avvalgi {delta.firstDays} kunga
                    nisbatan
                  </span>
                </p>
              )}

              {!hasRevenue ? (
                <EmptyState
                  compact
                  icon={<Inbox size={20} />}
                  title="Bu davrda tushum yo'q"
                  description="Buyurtmalar kelgach diagramma to'ladi."
                />
              ) : (
                <ul className="flex h-48 items-end gap-2">
                  {data.revenue.map((r) => (
                    <li key={r.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <span className="font-mono text-micro text-muted tabular-nums">
                        {Math.round(r.total / 1000)}k
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        {/* Diagramma dekorativ emas, lekin qiymat yozuv bilan
                            ham beriladi — faqat rangga tayanmaydi. */}
                        <div
                          className="w-full rounded-t-ds-xs bg-gradient-mint"
                          style={{ height: `${Math.max(2, (r.total / maxRevenue) * 100)}%` }}
                          role="img"
                          aria-label={`${r.day}: ${money(r.total)}`}
                        />
                      </div>
                      <span className="text-micro text-subtle">{r.day}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Eng ko&apos;p sotilgan taomlar</CardTitle>
              </CardHeader>

              {data.topDishes.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Inbox size={20} />}
                  title="Ma'lumot yig'ilmagan"
                  description="Kamida bitta yakunlangan buyurtma kerak."
                />
              ) : (
                <ul className="flex flex-col gap-4">
                  {data.topDishes.map((t) => (
                    <li key={t.name}>
                      <div className="mb-1.5 flex justify-between gap-3">
                        <span className="text-body font-semibold text-ink truncate">{t.name}</span>
                        <span className="font-mono text-body text-muted tabular-nums">{t.qty} ta</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-mint-deep"
                          style={{ width: `${Math.max(4, (t.qty / maxDish) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card padding="lg">
            <CardHeader>
              <CardTitle>Soatlar bo&apos;yicha yuklama</CardTitle>
              {peakHour && (
                <span className="text-caption text-muted">
                  Eng band soat:{' '}
                  <span className="font-mono font-bold text-ink">{peakHour.hour}:00</span>
                </span>
              )}
            </CardHeader>

            <ul className="flex h-40 items-end gap-1.5">
              {data.hourly.map((h) => {
                const peak = peakHour != null && h.hour === peakHour.hour && h.count > 0;
                return (
                  <li key={h.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={clsx('w-full rounded-t-ds-xs', peak ? 'bg-primary' : 'bg-info/55')}
                        style={{ height: `${Math.max(2, (h.count / maxHourly) * 100)}%` }}
                        role="img"
                        aria-label={`${h.hour}:00 — ${h.count} ta buyurtma${peak ? ' (eng band soat)' : ''}`}
                      />
                    </div>
                    <span className={clsx('font-mono text-micro', peak ? 'text-primary-text' : 'text-subtle')}>
                      {h.hour}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
