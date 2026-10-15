'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { getDispatchOverrides, getSosTodaySummary, DispatchOverride } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageBody } from '@/components/ui/PageBody';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { Skeleton, SkeletonStats } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, formatNumber, formatTime, shortId } from '@/lib/format';

// One page of overrides is what the report reads; the caveat under the KPI
// row says so rather than implying the whole history was summed.
const FETCH_LIMIT = 100;

type Period = 'today' | '7d' | '30d';

const PERIODS: readonly { value: Period; label: string }[] = [
  { value: 'today', label: 'Bugun' },
  { value: '7d', label: '7 kun' },
  { value: '30d', label: '30 kun' },
];

function periodStart(period: Period): Date {
  const from = new Date();
  if (period === 'today') from.setHours(0, 0, 0, 0);
  else from.setDate(from.getDate() - (period === '7d' ? 7 : 30));
  return from;
}

export default function ShiftReportPage() {
  const { toast } = useToast();

  const [overrides, setOverrides] = useState<DispatchOverride[]>([]);
  const [sos, setSos] = useState<{ resolvedToday: number; stillOpen: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('today');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [overridesResult, sosResult] = await Promise.all([
        getDispatchOverrides(1, FETCH_LIMIT),
        getSosTodaySummary(),
      ]);
      setOverrides(overridesResult.overrides);
      setSos(sosResult);
      setError(null);
    } catch (err) {
      console.error('Failed to load shift report:', err);
      setError('Smena hisobotini yuklab boʻlmadi.');
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const inPeriod = useMemo(() => {
    const cutoff = periodStart(period).getTime();
    return overrides
      .filter((o) => new Date(o.createdAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [overrides, period]);

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? '';

  const handleExport = () => {
    if (inPeriod.length === 0) return;
    downloadCsv(
      `smena-hisoboti-${period}`,
      ['Vaqt', 'Buyurtma', 'Operator', 'Oldingi haydovchi', 'Yangi haydovchi', 'Sabab'],
      inPeriod.map((o) => [
        formatDateTime(o.createdAt, { withYear: true }),
        shortId(o.orderId),
        o.performedByUserId,
        o.previousDriverId ?? '',
        o.newDriverId,
        o.reason,
      ])
    );
    toast({
      title: `${inPeriod.length} ta aralashuv CSV faylga eksport qilindi`,
      description: `Davr: ${periodLabel}`,
      variant: 'success',
    });
  };

  const showSkeleton = isLoading && !hasLoadedOnce;

  return (
    <PageBody className="max-w-5xl">
        <PageHeader
          title="Smena hisoboti"
          description="Operator hal qilgan istisnolar — davr boʻyicha"
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={inPeriod.length === 0}
                leftIcon={<Download size={13} aria-hidden />}
                title="Tanlangan davr yozuvlarini CSV sifatida yuklab olish"
              >
                CSV eksport
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchData}
                isLoading={isLoading && hasLoadedOnce}
                leftIcon={<RefreshCw size={13} aria-hidden />}
              >
                Yangilash
              </Button>
            </>
          }
        />

        {/* Period presets — one active at a time, today is the shift default. */}
        <SegmentedControl
          items={PERIODS}
          value={period}
          onChange={setPeriod}
          ariaLabel="Hisobot davri"
          className="mb-4"
        />

        {error && hasLoadedOnce && (
          <RetryBanner message={error} onRetry={fetchData} keepsLastData className="mb-4" />
        )}

        {error && !hasLoadedOnce ? (
          <Card padding="none">
            <ErrorState
              title={error}
              message="Tarmoq yoki server xatosi. Qayta urinib koʻring."
              onRetry={fetchData}
              retrying={isLoading}
            />
          </Card>
        ) : (
          <div className="space-y-6">
            {showSkeleton ? (
              <SkeletonStats count={3} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Amber = a human stepped in: the one KPI that earns it. */}
                <StatCard
                  label={`Qoʻlda aralashuvlar · ${periodLabel}`}
                  value={formatNumber(inPeriod.length)}
                  tone={inPeriod.length > 0 ? 'override' : 'neutral'}
                  hint="Har biri sababi bilan amallar tarixiga yozilgan"
                />
                {/* The SOS endpoint returns today's figures only — the label
                    says «bugun» in every period so the number is never read
                    as the selected range. */}
                <StatCard
                  label="Yopilgan SOS · bugun"
                  value={formatNumber(sos?.resolvedToday ?? 0)}
                  hint={sos && sos.stillOpen > 0 ? `${sos.stillOpen} tasi hali ochiq` : 'Ochiq signal qolmadi'}
                />
                <StatCard
                  label="Ochiq SOS signallari"
                  value={formatNumber(sos?.stillOpen ?? 0)}
                  tone={sos && sos.stillOpen > 0 ? 'danger' : 'neutral'}
                  hint={sos && sos.stillOpen > 0 ? 'Istisnolar sahifasida koʻrib chiqing' : 'Hammasi yopilgan'}
                />
              </div>
            )}

            <p className="text-xs text-subtle -mt-3">
              Aralashuvlar oxirgi {FETCH_LIMIT} ta yozuvdan hisoblanadi. SOS koʻrsatkichlari faqat
              bugungi kun uchun mavjud.
            </p>

            <Card padding="none" className="overflow-hidden">
              <CardHeader
                title={`Aralashuvlar · ${periodLabel}`}
                divider
                actions={
                  !showSkeleton && inPeriod.length > 0 ? (
                    <Badge variant="neutral" size="sm">
                      {inPeriod.length}
                    </Badge>
                  ) : undefined
                }
              />

              {showSkeleton ? (
                <div className="p-4 space-y-2" aria-busy="true">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : inPeriod.length === 0 ? (
                <EmptyState
                  compact
                  variant="cleared"
                  icon={<CheckCircle2 aria-hidden />}
                  title={
                    period === 'today'
                      ? 'Bugun qoʻlda aralashuv boʻlmadi'
                      : `Bu davrda (${periodLabel}) aralashuv boʻlmadi`
                  }
                  description="Tizim barcha buyurtmalarni oʻzi taqsimladi."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {inPeriod.map((o) => (
                    // Amber left edge = a human intervened, the same mark the
                    // audit log uses. It appears nowhere else on this page.
                    <li
                      key={o.id}
                      className="px-4 py-3 flex items-start justify-between gap-3 border-l-2 border-l-override"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/orders/${o.orderId}`}
                            className="font-mono text-xs text-primary-text hover:underline"
                          >
                            {shortId(o.orderId)}
                          </Link>
                          <Badge variant="override" size="sm">
                            Qoʻlda aralashuv
                          </Badge>
                        </div>
                        <p className="text-[13px] text-ink mt-1 break-words">{o.reason}</p>
                      </div>
                      <span
                        className="num text-xs text-subtle shrink-0"
                        title={formatDateTime(o.createdAt)}
                      >
                        {period === 'today' ? formatTime(o.createdAt) : formatDateTime(o.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
    </PageBody>
  );
}
