'use client';

import { useCallback, useState } from 'react';
import { BarChart3, Inbox } from 'lucide-react';
import { clsx } from 'clsx';
import { foodApi, ReportsData } from '@/lib/api';
import { useAsyncData } from '@/hooks/useAsyncData';
import { money } from '@/lib/utils';
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

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Hisobotlar"
        description="Tushum, ommabop taomlar va yuklama"
        icon={<BarChart3 size={20} />}
        actions={
          <Tabs
            items={RANGES}
            value={range}
            onChange={(v) => setRange(v)}
            label="Hisobot davri"
            size="sm"
          />
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
