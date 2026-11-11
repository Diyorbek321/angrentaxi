'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Drawer } from '@/components/ui/Drawer';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { adsApi, type AdBanner, type AdDailyRow } from '@/lib/api';
import { adCtr, dailyTotals, formatCtr } from '@/lib/ads';
import { CHART_COLORS } from '@/lib/chart-tokens';
import { formatNumber } from '@/lib/format';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { t } from '@/locales';

const DAYS = 30;
/** Fewer points than this is not a trend — show an empty state instead. */
const MIN_CHART_POINTS = 3;

const shortDay = (day: string) => {
  try {
    return format(parseISO(day), 'dd.MM');
  } catch {
    return day;
  }
};

/**
 * Bannerning kunlik hisoboti — reklama beruvchiga "qaysi kuni qancha".
 *
 * Grafikda faqat ko'rishlar: bosishlar ulardan ~100 marta kam, bitta o'qda
 * ular nolga yopishib ko'rinardi. Bosish va CTR jadvalda, kun bo'yicha.
 * Kunlik kesim migratsiya 021 dan boshlanadi — undan oldingi ko'rishlar
 * faqat jadvaldagi jami sonda.
 */
export function AdDailyDrawer({ ad, onClose }: { ad: AdBanner | null; onClose: () => void }) {
  const m = t().ads.daily;
  const reducedMotion = useReducedMotion();
  const [rows, setRows] = useState<AdDailyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ad) return;
    let cancelled = false;
    setRows(null);
    setError(null);
    adsApi
      .daily(ad.id, DAYS)
      .then((res) => !cancelled && setRows(res.data.data))
      .catch(() => !cancelled && setError(m.loadError));
    return () => {
      cancelled = true;
    };
  }, [ad, attempt]);

  const totals = rows ? dailyTotals(rows) : null;

  return (
    <Drawer
      isOpen={!!ad}
      onClose={onClose}
      title={ad ? m.title(ad.title) : undefined}
      subtitle={
        totals
          ? m.subtitleTotals(DAYS, formatNumber(totals.impressions), formatNumber(totals.clicks), formatCtr(totals.ctr))
          : m.subtitle(DAYS)
      }
      width="lg"
    >
      {error ? (
        <ErrorState compact message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !rows ? (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-[220px] w-full rounded-ds-md" />
          <Skeleton className="h-40 w-full rounded-ds-md" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {rows.length < MIN_CHART_POINTS ? (
            <EmptyState compact title={m.notEnoughData} />
          ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: number) => [formatNumber(value), m.impressions]}
                labelFormatter={shortDay}
              />
              <Bar
                dataKey="impressions"
                fill={CHART_COLORS.primary}
                radius={[3, 3, 0, 0]}
                maxBarSize={32}
                isAnimationActive={!reducedMotion}
              />
            </BarChart>
          </ResponsiveContainer>
          )}

          <div className="overflow-hidden rounded-ds-md border border-line">
          <Table compact>
            <TableHeader>
              <TableRow>
                <TableHead>{m.colDay}</TableHead>
                <TableHead className="text-right">{m.colImpressions}</TableHead>
                <TableHead className="text-right">{m.colClicks}</TableHead>
                <TableHead className="text-right">CTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Yangisi tepada — odatda bugungi kun so'raladi. */}
              {[...rows].reverse().map((r) => (
                <TableRow key={r.day}>
                  <TableCell className="num text-muted">{format(parseISO(r.day), 'dd.MM.yyyy')}</TableCell>
                  <TableCell className="num text-right text-ink">
                    {formatNumber(r.impressions)}
                  </TableCell>
                  <TableCell className="num text-right text-ink">
                    {formatNumber(r.clicks)}
                  </TableCell>
                  <TableCell className="num text-right text-muted">
                    {formatCtr(adCtr(r))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      )}
    </Drawer>
  );
}
