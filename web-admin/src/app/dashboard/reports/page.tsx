'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import {
  AlertTriangle,
  BarChart3,
  DollarSign,
  Download,
  ShoppingCart,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonStats, SkeletonTable } from '@/components/ui/Skeleton';
import {
  DateRangeFilter,
  DATE_PRESET_LABELS,
  rangeForPreset,
  type DateRangeValue,
} from '@/components/ui/DateRangeFilter';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { OrdersChart } from '@/components/charts/OrdersChart';
import { reportsApi, ReportData, RevenueDataPoint, TopDriver } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatCurrency, formatDate, formatRating, getFullName } from '@/lib/utils';

const DATE_FMT = 'yyyy-MM-dd';

/** Hisobotda "filtrsiz" holat yo'q — davr har doim tanlangan bo'ladi. */
const DEFAULT_RANGE: DateRangeValue = { preset: '7d', ...rangeForPreset('7d') };

const RANK_STYLE = [
  'bg-primary text-white',
  'bg-surface-3 text-ink',
  'bg-override-tint text-override-dark dark:text-override-light',
] as const;

/**
 * Foizli o'zgarish — FAQAT ikkala davr ham haqiqatda yuklanganda.
 * Oldingi davr nolga teng bo'lsa foiz ma'nosiz (∞), shuning uchun `null`.
 */
function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ReportData | null>(null);
  /** Oldingi (teng uzunlikdagi) davr — taqqoslash deltasi FAQAT shundan. */
  const [previous, setPrevious] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [range, setRange] = useState<DateRangeValue>(DEFAULT_RANGE);

  const from = range.from ?? DEFAULT_RANGE.from!;
  const to = range.to ?? DEFAULT_RANGE.to!;

  // Oldingi davr — joriy davr bilan TENG uzunlikda, undan oldin turadi.
  const previousRange = useMemo(() => {
    try {
      const spanDays = Math.max(0, differenceInCalendarDays(parseISO(to), parseISO(from)));
      const prevTo = subDays(parseISO(from), 1);
      const prevFrom = subDays(prevTo, spanDays);
      return { from: format(prevFrom, DATE_FMT), to: format(prevTo, DATE_FMT) };
    } catch {
      return null;
    }
  }, [from, to]);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const [currentRes, previousRes] = await Promise.allSettled([
        reportsApi.getData({ from, to }),
        previousRange
          ? reportsApi.getData({ from: previousRange.from, to: previousRange.to })
          : Promise.reject(new Error('no previous range')),
      ]);

      if (currentRes.status === 'rejected') throw currentRes.reason;

      setData(currentRes.value.data.data);
      // Oldingi davr yuklanmasa — delta KO'RSATILMAYDI (o'ylab topilmaydi).
      setPrevious(previousRes.status === 'fulfilled' ? previousRes.value.data.data : null);
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      // Oxirgi muvaffaqiyatli hisobot ekranda qoladi; banner + retry chiqadi.
      const message = 'Hisobotni yuklashda xatolik';
      setError(message);
      toast({ title: 'Xatolik', description: message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, previousRange?.from, previousRange?.to]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const comparisonLabel = range.preset
    ? `oldingi ${DATE_PRESET_LABELS[range.preset].toLowerCase()}ga nisbatan`
    : 'oldingi davrga nisbatan';

  /** Delta faqat ikkala davr ham bor bo'lganda quriladi. */
  const trendFor = (pick: (r: ReportData) => number) => {
    if (!data || !previous) return undefined;
    const value = pctChange(pick(data), pick(previous));
    if (value == null) return undefined;
    return { value, label: comparisonLabel, positiveIsGood: true };
  };

  const revenueSeries = data?.revenueChart ?? [];
  const revenueSpark = revenueSeries.map((p) => p.revenue);
  const ordersSpark = revenueSeries.map((p) => p.orders);

  const handleExportSeries = () => {
    if (revenueSeries.length === 0) return;
    // Yangi API chaqirig'i YO'Q — ekrandagi yuklangan seriya eksport qilinadi.
    downloadCsv<RevenueDataPoint>(
      `hisobot-${from}-${to}.csv`,
      [
        { header: 'Sana', value: (p) => p.date },
        { header: 'Daromad', value: (p) => p.revenue },
        { header: 'Buyurtmalar', value: (p) => p.orders },
      ],
      revenueSeries
    );
    toast({ title: 'CSV yuklab olindi', description: `${revenueSeries.length} ta kun`, variant: 'success' });
  };

  const handleExportDrivers = () => {
    const drivers = data?.topDrivers ?? [];
    if (drivers.length === 0) return;
    downloadCsv<TopDriver>(
      `top-haydovchilar-${from}-${to}.csv`,
      [
        { header: 'Haydovchi', value: (d) => getFullName(d.firstName, d.lastName) },
        { header: 'Telefon', value: (d) => d.phone },
        { header: 'Safarlar', value: (d) => d.totalTrips },
        { header: 'Daromad', value: (d) => d.totalRevenue },
        { header: 'Reyting', value: (d) => formatRating(d.rating) },
      ],
      drivers
    );
    toast({ title: 'CSV yuklab olindi', description: `${drivers.length} ta haydovchi`, variant: 'success' });
  };

  const showFullError = error && !isLoading && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && hasLoadedOnce;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Hisobotlar"
        description={`${formatDate(from, 'dd.MM.yyyy')} — ${formatDate(to, 'dd.MM.yyyy')}`}
        icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSeries}
            disabled={revenueSeries.length === 0}
            leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            CSV eksport
          </Button>
        }
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeFilter
            value={range}
            // Faol presetni qayta bosish davrni "bo'sh" qilib qo'yardi —
            // hisobot uchun bu holat mavjud emas, standart davrga qaytamiz.
            onChange={(v) => setRange(v.preset ? v : DEFAULT_RANGE)}
          />
          {previous && (
            <p className="text-caption text-subtle">
              Taqqoslash davri: {formatDate(previousRange!.from, 'dd.MM.yyyy')} —{' '}
              {formatDate(previousRange!.to, 'dd.MM.yyyy')}
            </p>
          )}
        </div>

        {showErrorBanner && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-4 py-3"
          >
            <p className="flex items-center gap-2 text-body text-danger-deep dark:text-danger-light">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error} — oxirgi muvaffaqiyatli yuklangan hisobot ko&apos;rsatilmoqda.
            </p>
            <Button variant="secondary" size="sm" onClick={fetchReport}>
              Qayta urinish
            </Button>
          </div>
        )}

        {showFullError ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState message={error} onRetry={fetchReport} />
            </CardContent>
          </Card>
        ) : (
          <>
            {isLoading && !hasLoadedOnce ? (
              <SkeletonStats count={4} className="grid-cols-2 xl:grid-cols-4" />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Jami daromad"
                  value={data ? formatCurrency(data.stats.totalRevenue) : '—'}
                  icon={<DollarSign className="h-5 w-5" />}
                  variant="mint"
                  trend={trendFor((r) => r.stats.totalRevenue)}
                  sparkline={revenueSpark}
                  isLoading={isLoading}
                />
                <StatCard
                  title="Jami buyurtmalar"
                  value={data?.stats.totalOrders.toLocaleString('uz-UZ') ?? '—'}
                  icon={<ShoppingCart className="h-5 w-5" />}
                  variant="info"
                  trend={trendFor((r) => r.stats.totalOrders)}
                  sparkline={ordersSpark}
                  isLoading={isLoading}
                />
                <StatCard
                  title="O'rtacha buyurtma"
                  value={data ? formatCurrency(data.stats.avgOrderValue) : '—'}
                  icon={<TrendingUp className="h-5 w-5" />}
                  variant="mint"
                  trend={trendFor((r) => r.stats.avgOrderValue)}
                  isLoading={isLoading}
                />
                <StatCard
                  title="Yangi foydalanuvchilar"
                  value={data?.stats.newUsers.toLocaleString('uz-UZ') ?? '—'}
                  icon={<Users className="h-5 w-5" />}
                  variant="violet"
                  trend={trendFor((r) => r.stats.newUsers)}
                  isLoading={isLoading}
                />
              </div>
            )}

            {/* Diagrammalar chart-tokens ranglaridan va reduced-motion
                naqshidan foydalanadi (OrdersChart/RevenueChart ichida). */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <RevenueChart data={revenueSeries} isLoading={isLoading && !hasLoadedOnce} />
              <OrdersChart data={revenueSeries} isLoading={isLoading && !hasLoadedOnce} />
            </div>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Top haydovchilar</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportDrivers}
                  disabled={(data?.topDrivers.length ?? 0) === 0}
                  leftIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading && !hasLoadedOnce ? (
                  <SkeletonTable rows={5} cols={6} className="border-0" />
                ) : !data || data.topDrivers.length === 0 ? (
                  <EmptyState
                    title="Bu davrda ma'lumot yo'q"
                    description="Tanlangan davrda yakunlangan safar bo'lmagan — boshqa davrni tanlab ko'ring."
                  />
                ) : (
                  <Table stickyHeader containerClassName="max-h-[55vh]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Haydovchi</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead className="text-right">Safarlar</TableHead>
                        <TableHead className="text-right">Daromad</TableHead>
                        <TableHead className="text-right">Reyting</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topDrivers.map((driver, index) => (
                        <TableRow key={driver.id}>
                          <TableCell>
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-caption font-bold tabular-nums ${
                                RANK_STYLE[index] ?? 'bg-surface-2 text-muted'
                              }`}
                            >
                              {index + 1}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint-tint text-caption font-bold text-primary-text"
                                aria-hidden="true"
                              >
                                {driver.firstName?.charAt(0)}
                              </div>
                              <span className="font-medium text-ink">
                                {getFullName(driver.firstName, driver.lastName)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-caption text-muted">
                            {driver.phone}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-ink">
                            {driver.totalTrips}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold tabular-nums text-ink">
                            {formatCurrency(driver.totalRevenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center gap-1">
                              <Star
                                className="h-3.5 w-3.5 fill-override text-override"
                                aria-hidden="true"
                              />
                              <span className="font-mono tabular-nums text-ink">
                                {formatRating(driver.rating)}
                              </span>
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
