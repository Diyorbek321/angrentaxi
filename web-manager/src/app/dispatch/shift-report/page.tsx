'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Download,
  RefreshCw,
  ShieldAlert,
  Timer,
  UserCog,
} from 'lucide-react';
import { getDispatchOverrides, getSosTodaySummary, DispatchOverride } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, formatTime, shortId } from '@/lib/format';

// One page of overrides is what the report reads; the caveat under the KPI
// row says so rather than implying the whole history was summed.
const FETCH_LIMIT = 100;

type Period = 'today' | '7d' | '30d';

const PERIODS: { value: Period; label: string }[] = [
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

function SummaryCard({
  icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  tone?: 'neutral' | 'override' | 'danger';
}) {
  const toneClass =
    tone === 'override'
      ? 'text-override-dark dark:text-override-light'
      : tone === 'danger'
      ? 'text-danger-deep dark:text-danger-light'
      : 'text-ink';

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={toneClass}>{icon}</span>
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className={`font-mono text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-xs text-subtle mt-1 leading-snug">{hint}</p>
    </Card>
  );
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
        new Date(o.createdAt).toLocaleString('uz-UZ'),
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
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-5xl mx-auto">
        <PageHeader
          title="Smena hisoboti"
          description="Operator hal qilgan istisnolar — davr boʻyicha"
          icon={<Timer size={17} />}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={inPeriod.length === 0}
                leftIcon={<Download size={13} />}
                title="Tanlangan davr yozuvlarini CSV sifatida yuklab olish"
              >
                CSV eksport
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchData}
                leftIcon={<RefreshCw size={13} />}
              >
                Yangilash
              </Button>
            </>
          }
        />

        {/* Period presets — one active at a time, today is the shift default. */}
        <div
          role="group"
          aria-label="Hisobot davri"
          className="inline-flex items-center rounded-ds-sm border border-line bg-surface-2/60 p-0.5 mb-4"
        >
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={`h-8 px-3 rounded-ds-xs text-xs font-medium transition-colors ${
                period === p.value
                  ? 'bg-surface text-ink shadow-card border border-line'
                  : 'text-muted hover:text-ink border border-transparent'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <RetryBanner
            message={error}
            onRetry={fetchData}
            keepsLastData={hasLoadedOnce && overrides.length > 0}
            className="mb-4"
          />
        )}

        {error && !hasLoadedOnce ? (
          <ErrorState
            message="Tarmoq yoki server xatosi. Qayta urinib koʻring."
            onRetry={fetchData}
          />
        ) : (
          <div className="space-y-6">
            {showSkeleton ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-busy="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[116px] rounded-ds-md" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard
                  icon={<UserCog size={16} />}
                  label={`Qoʻlda aralashuvlar · ${periodLabel}`}
                  value={inPeriod.length}
                  tone="override"
                  hint="Har biri sababi bilan amallar tarixiga yozilgan"
                />
                {/* The SOS endpoint returns today's figures only — the label
                    says «bugun» in every period so the number is never read
                    as the selected range. */}
                <SummaryCard
                  icon={<ShieldAlert size={16} />}
                  label="Yopilgan SOS · bugun"
                  value={sos?.resolvedToday ?? 0}
                  tone="danger"
                  hint={
                    sos && sos.stillOpen > 0
                      ? `${sos.stillOpen} tasi hali ochiq`
                      : 'Ochiq signal qolmadi'
                  }
                />
                <SummaryCard
                  icon={<CheckCircle2 size={16} />}
                  label="Ochiq SOS signallari"
                  value={sos?.stillOpen ?? 0}
                  hint={
                    sos && sos.stillOpen > 0
                      ? 'Istisnolar sahifasida koʻrib chiqing'
                      : 'Hammasi yopilgan'
                  }
                />
              </div>
            )}

            <p className="text-[11px] text-subtle -mt-3">
              Aralashuvlar oxirgi {FETCH_LIMIT} ta yozuvdan hisoblanadi. SOS koʻrsatkichlari faqat
              bugungi kun uchun mavjud.
            </p>

            <Card padding="none" className="overflow-hidden">
              <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink">Aralashuvlar · {periodLabel}</h2>
                {!showSkeleton && inPeriod.length > 0 && (
                  <Badge variant="override" size="sm">
                    {inPeriod.length}
                  </Badge>
                )}
              </div>

              {showSkeleton ? (
                <div className="p-4 space-y-2" aria-busy="true">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : inPeriod.length === 0 ? (
                <EmptyState
                  compact
                  tone="positive"
                  icon={<CheckCircle2 size={20} />}
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
                        <p className="text-sm text-ink mt-1 break-words">{o.reason}</p>
                      </div>
                      <span
                        className="font-mono text-xs text-subtle shrink-0 tabular-nums"
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
      </div>
    </div>
  );
}
