'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldAlert, Timer, UserCog } from 'lucide-react';
import { getDispatchOverrides, getSosTodaySummary, DispatchOverride } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatTime, shortId } from '@/lib/format';

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
      ? 'text-danger'
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
  const [overrides, setOverrides] = useState<DispatchOverride[]>([]);
  const [sos, setSos] = useState<{ resolvedToday: number; stillOpen: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [overridesResult, sosResult] = await Promise.all([
        getDispatchOverrides(1, 100),
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
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const overridesToday = overrides.filter((o) => new Date(o.createdAt) >= startOfToday);

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-5xl mx-auto">
        <PageHeader
          title="Smena hisoboti"
          description="Bugun operator hal qilgan istisnolar"
          icon={<Timer size={17} />}
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchData}
              leftIcon={<RefreshCw size={13} />}
            >
              Yangilash
            </Button>
          }
        />

        {error ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : (
          <div className="space-y-6">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[116px] rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard
                  icon={<UserCog size={16} />}
                  label="Bugungi qoʻlda aralashuvlar"
                  value={overridesToday.length}
                  tone="override"
                  hint={
                    overridesToday.length > 5
                      ? 'Odatdagidan koʻp — sabablarini koʻrib chiqing'
                      : 'Har biri sababi bilan amallar tarixiga yozilgan'
                  }
                />
                <SummaryCard
                  icon={<ShieldAlert size={16} />}
                  label="Bugun yopilgan SOS"
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
                  label="Bugungi jami istisnolar"
                  value={overridesToday.length + (sos?.resolvedToday ?? 0)}
                  hint="Aralashuvlar + yopilgan SOS signallari"
                />
              </div>
            )}

            <Card padding="none" className="overflow-hidden">
              <div className="px-4 py-3 border-b border-line">
                <h2 className="text-sm font-semibold text-ink">Bugungi aralashuvlar</h2>
              </div>

              {isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : overridesToday.length === 0 ? (
                <EmptyState
                  compact
                  tone="positive"
                  icon={<CheckCircle2 size={20} />}
                  title="Bugun qoʻlda aralashuv boʻlmadi"
                  description="Tizim barcha buyurtmalarni oʻzi taqsimladi."
                />
              ) : (
                <div className="divide-y divide-line">
                  {overridesToday.map((o) => (
                    <div key={o.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted">
                            {shortId(o.orderId)}
                          </span>
                          <Badge variant="override" size="sm">
                            Aralashuv
                          </Badge>
                        </div>
                        <p className="text-sm text-ink mt-1 break-words">{o.reason}</p>
                      </div>
                      <span className="font-mono text-xs text-subtle shrink-0">
                        {formatTime(o.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
