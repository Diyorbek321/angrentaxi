'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { Download } from 'lucide-react';
import {
  Button,
  Card,
  DataTable,
  DateRangeFilter,
  DATE_PRESET_LABELS,
  ErrorState,
  MoneyText,
  PageHeader,
  RetryBanner,
  SkeletonStats,
  StatCard,
  rangeForPreset,
  useToast,
  type DataTableColumn,
  type DateRangeValue,
} from '@/components/ui';
import { OrdersChart, RevenueChart } from '@/components/charts/lazy';
import { reportsApi, type ReportData, type RevenueDataPoint, type TopDriver } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { formatDateShort, formatMoney, formatNumber, formatPhone, formatRating, fullName } from '@/lib/format';

const DATE_FMT = 'yyyy-MM-dd';

/** Hisobotda "filtrsiz" holat yo'q — davr har doim tanlangan bo'ladi. */
const DEFAULT_RANGE: DateRangeValue = { preset: '7d', ...rangeForPreset('7d') };

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
      setError('Hisobotni yuklab boʻlmadi.');
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
        { header: 'Haydovchi', value: (d) => fullName(d.firstName, d.lastName) },
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
  const firstLoad = isLoading && !hasLoadedOnce;

  const driverColumns: DataTableColumn<TopDriver>[] = [
    {
      key: 'rank',
      header: '#',
      width: 'w-10',
      cell: (_d, i) => <span className="num text-muted">{i + 1}</span>,
    },
    {
      key: 'name',
      header: 'Haydovchi',
      cell: (d) => <span className="font-medium">{fullName(d.firstName, d.lastName)}</span>,
    },
    {
      key: 'phone',
      header: 'Telefon',
      hideBelow: 'md',
      cell: (d) => <span className="num whitespace-nowrap text-muted">{formatPhone(d.phone)}</span>,
    },
    { key: 'trips', header: 'Safarlar', numeric: true, cell: (d) => formatNumber(d.totalTrips) },
    { key: 'revenue', header: 'Daromad', numeric: true, cell: (d) => <MoneyText value={d.totalRevenue} /> },
    { key: 'rating', header: 'Reyting', numeric: true, cell: (d) => formatRating(d.rating) },
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Hisobotlar"
        description={`${formatDateShort(from)} — ${formatDateShort(to)}${
          previous && previousRange
            ? ` · taqqoslash: ${formatDateShort(previousRange.from)} — ${formatDateShort(previousRange.to)}`
            : ''
        }`}
        actions={
          <Button
            variant="secondary"
            onClick={handleExportSeries}
            disabled={revenueSeries.length === 0}
            leftIcon={<Download size={14} aria-hidden />}
          >
            CSV eksport
          </Button>
        }
      />

      <div className="space-y-5">
        <DateRangeFilter
          value={range}
          // Re-clicking the active preset would clear the range — a report
          // always has a period, so fall back to the default one.
          onChange={(v) => setRange(v.preset ? v : DEFAULT_RANGE)}
        />

        {showErrorBanner && (
          <RetryBanner message={error} onRetry={fetchReport} keepsLastData retrying={isLoading} />
        )}

        {showFullError ? (
          <Card padding="none">
            <ErrorState message={error} onRetry={fetchReport} />
          </Card>
        ) : (
          <>
            {firstLoad ? (
              <SkeletonStats count={4} />
            ) : (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard
                  label="Jami daromad"
                  value={formatMoney(data?.stats.totalRevenue, { currency: false })}
                  unit="soʻm"
                  delta={trendFor((r) => r.stats.totalRevenue)}
                  isLoading={isLoading}
                />
                <StatCard
                  label="Jami buyurtmalar"
                  value={formatNumber(data?.stats.totalOrders)}
                  delta={trendFor((r) => r.stats.totalOrders)}
                  isLoading={isLoading}
                />
                <StatCard
                  label="Oʻrtacha buyurtma"
                  value={formatMoney(data?.stats.avgOrderValue, { currency: false })}
                  unit="soʻm"
                  delta={trendFor((r) => r.stats.avgOrderValue)}
                  isLoading={isLoading}
                />
                <StatCard
                  label="Yangi foydalanuvchilar"
                  value={formatNumber(data?.stats.newUsers)}
                  delta={trendFor((r) => r.stats.newUsers)}
                  isLoading={isLoading}
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <RevenueChart data={revenueSeries} isLoading={firstLoad} />
              <OrdersChart data={revenueSeries} isLoading={firstLoad} />
            </div>

            <DataTable
              title="Top haydovchilar"
              description="Tanlangan davrdagi daromad boʻyicha"
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportDrivers}
                  disabled={(data?.topDrivers.length ?? 0) === 0}
                  leftIcon={<Download size={13} aria-hidden />}
                >
                  CSV
                </Button>
              }
              ariaLabel="Top haydovchilar"
              columns={driverColumns}
              rows={data?.topDrivers ?? []}
              rowKey={(d) => d.id}
              loading={firstLoad}
              maxHeightClassName="max-h-[55vh]"
              empty={{
                title: 'Bu davrda maʼlumot yoʻq',
                description: 'Tanlangan davrda yakunlangan safar boʻlmagan — boshqa davrni tanlab koʻring.',
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
