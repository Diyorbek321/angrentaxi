'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Drawer } from '@/components/ui/Drawer';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { adsApi, type AdBanner, type AdDailyRow } from '@/lib/api';
import { adCtr, dailyTotals, formatCtr } from '@/lib/ads';
import { CHART_COLORS } from '@/lib/chart-tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const DAYS = 30;

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
      .catch(() => !cancelled && setError("Hisobotni yuklab bo'lmadi"));
    return () => {
      cancelled = true;
    };
  }, [ad, attempt]);

  const totals = rows ? dailyTotals(rows) : null;

  return (
    <Drawer
      isOpen={!!ad}
      onClose={onClose}
      title={ad ? `«${ad.title}» — kunlik hisobot` : undefined}
      subtitle={
        totals
          ? `Oxirgi ${DAYS} kun: ${totals.impressions.toLocaleString('uz-UZ')} ko'rish · ${totals.clicks.toLocaleString('uz-UZ')} bosish · CTR ${formatCtr(totals.ctr)}`
          : `Oxirgi ${DAYS} kun`
      }
      width="lg"
    >
      {error ? (
        <ErrorState compact message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !rows ? (
        <Skeleton className="h-[220px] w-full rounded-ds-md" />
      ) : (
        <div className="flex flex-col gap-5">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString('uz-UZ'), "Ko'rish"]}
                labelFormatter={shortDay}
                cursor={{ fill: 'rgba(16,160,100,0.08)' }}
              />
              <Bar
                dataKey="impressions"
                fill={CHART_COLORS.primary}
                radius={[3, 3, 0, 0]}
                isAnimationActive={!reducedMotion}
              />
            </BarChart>
          </ResponsiveContainer>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kun</TableHead>
                <TableHead className="text-right">Ko&apos;rish</TableHead>
                <TableHead className="text-right">Bosish</TableHead>
                <TableHead className="text-right">CTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Yangisi tepada — odatda bugungi kun so'raladi. */}
              {[...rows].reverse().map((r) => (
                <TableRow key={r.day}>
                  <TableCell className="tabular-nums text-muted">{format(parseISO(r.day), 'dd.MM.yyyy')}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-ink">
                    {r.impressions.toLocaleString('uz-UZ')}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-ink">
                    {r.clicks.toLocaleString('uz-UZ')}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted">
                    {formatCtr(adCtr(r))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Drawer>
  );
}
