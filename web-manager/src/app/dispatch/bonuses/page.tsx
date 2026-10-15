'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Gift, RefreshCw, Users } from 'lucide-react';
import {
  getBonusRules,
  getDriverBonusProgress,
  DriverBonusRule,
  DriverBonusProgress,
} from '@/lib/api';
import { useDispatchData } from '@/components/dispatch/DispatchDataContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageBody } from '@/components/ui/PageBody';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatMoney, formatNumber, formatPhone } from '@/lib/format';

const ruleTypeLabel: Record<DriverBonusRule['ruleType'], string> = {
  trip_count: 'Safar soni',
  weekly_goal: 'Haftalik maqsad',
};

type RuleFilter = 'active' | 'inactive' | 'all';

const RULE_TABS: readonly { value: RuleFilter; label: string }[] = [
  { value: 'active', label: 'Faol' },
  { value: 'inactive', label: 'Faol emas' },
  { value: 'all', label: 'Hammasi' },
];

export default function BonusesPage() {
  const { toast } = useToast();

  const [rules, setRules] = useState<DriverBonusRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>('active');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [progress, setProgress] = useState<DriverBonusProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  // Online drivers come from the shell provider — no extra live request here.
  const { drivers } = useDispatchData();

  const loadRules = () => {
    setIsLoading(true);
    getBonusRules()
      .then((r) => {
        setRules(r);
        setRulesError(null);
      })
      .catch(() => setRulesError('Bonus qoidalarini yuklab boʻlmadi.'))
      .finally(() => {
        setIsLoading(false);
        setHasLoadedOnce(true);
      });
  };

  useEffect(() => {
    loadRules();
  }, []);

  const loadProgress = (driverId: string) => {
    setProgressLoading(true);
    getDriverBonusProgress(driverId)
      .then((p) => {
        setProgress(p);
        setProgressError(null);
      })
      .catch(() => setProgressError('Haydovchi progressini yuklab boʻlmadi.'))
      .finally(() => setProgressLoading(false));
  };

  useEffect(() => {
    if (!selectedDriverId) {
      setProgress([]);
      setProgressError(null);
      return;
    }
    loadProgress(selectedDriverId);
  }, [selectedDriverId]);

  const visibleRules = useMemo(
    () =>
      rules
        .filter((r) =>
          ruleFilter === 'all' ? true : ruleFilter === 'active' ? r.status === 'active' : r.status !== 'active'
        )
        .sort((a, b) => a.tripThreshold - b.tripThreshold),
    [rules, ruleFilter]
  );

  const activeCount = rules.filter((r) => r.status === 'active').length;
  const showSkeleton = isLoading && !hasLoadedOnce;

  const handleExport = () => {
    if (visibleRules.length === 0) return;
    downloadCsv(
      'bonus-qoidalari',
      ['Nomi', 'Turi', 'Safar chegarasi', 'Bonus (soʻm)', 'Xizmat turi', 'Holati'],
      visibleRules.map((r) => [
        r.name,
        ruleTypeLabel[r.ruleType],
        r.tripThreshold,
        r.bonusAmount,
        r.serviceType ?? 'Barchasi',
        r.status === 'active' ? 'Faol' : 'Faol emas',
      ])
    );
    toast({
      title: `${visibleRules.length} ta qoida CSV faylga eksport qilindi`,
      variant: 'success',
    });
  };

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  return (
    <PageBody className="max-w-5xl">
        <PageHeader
          title="Bonuslar"
          description="Bonus qoidalari va haydovchi progressi (qoidalarni faqat admin qoʻsha oladi)"
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={visibleRules.length === 0}
                leftIcon={<Download size={13} aria-hidden />}
              >
                CSV eksport
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadRules}
                isLoading={isLoading && hasLoadedOnce}
                leftIcon={<RefreshCw size={13} aria-hidden />}
              >
                Yangilash
              </Button>
            </>
          }
        />

        {rulesError && rules.length > 0 && (
          <RetryBanner message={rulesError} onRetry={loadRules} keepsLastData className="mb-4" />
        )}

        <div className="space-y-5">
          <Card padding="none">
            <CardHeader
              title="Bonus qoidalari"
              description={activeCount > 0 ? `${activeCount} ta faol qoida` : undefined}
              actions={
                <SegmentedControl
                  items={RULE_TABS}
                  value={ruleFilter}
                  onChange={setRuleFilter}
                  size="sm"
                  ariaLabel="Qoidalar filtri"
                />
              }
            />
            <CardBody>

            {rulesError && rules.length === 0 ? (
              <ErrorState
                compact
                title={rulesError}
                message="Tarmoq yoki server xatosi. Qayta urinib koʻring."
                onRetry={loadRules}
                retrying={isLoading}
              />
            ) : showSkeleton ? (
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                aria-busy="true"
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[104px] rounded-ds-md" />
                ))}
              </div>
            ) : visibleRules.length === 0 ? (
              <EmptyState
                compact
                variant={ruleFilter !== 'all' && rules.length > 0 ? 'no-results' : 'first-use'}
                icon={<Gift aria-hidden />}
                title={
                  ruleFilter === 'active'
                    ? 'Faol bonus qoidasi yoʻq'
                    : ruleFilter === 'inactive'
                    ? 'Oʻchirilgan qoida yoʻq'
                    : 'Bonus qoidasi yoʻq'
                }
                description="Yangi qoidalar admin panelida qoʻshiladi."
                action={
                  ruleFilter !== 'all' && rules.length > 0 ? (
                    <Button variant="secondary" size="sm" onClick={() => setRuleFilter('all')}>
                      Barcha qoidalar
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-ds-md border border-line bg-surface-2/50 p-3.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-title text-ink truncate min-w-0">{rule.name}</p>
                      <Badge variant="neutral" size="sm">
                        {ruleTypeLabel[rule.ruleType]}
                      </Badge>
                    </div>
                    <p className="text-[13px] text-muted">
                      Har <span className="num text-ink">{formatNumber(rule.tripThreshold)}</span> safar
                      uchun <MoneyText value={rule.bonusAmount} className="font-semibold text-ink" />
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.status === 'active' ? 'success' : 'neutral'} size="sm" dot>
                        {rule.status === 'active' ? 'Faol' : 'Faol emas'}
                      </Badge>
                      {rule.serviceType && (
                        <span className="text-[11px] text-subtle truncate">{rule.serviceType}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader
              title="Haydovchi progressi"
              actions={
                selectedDriver ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadProgress(selectedDriver.id)}
                    isLoading={progressLoading}
                    leftIcon={<RefreshCw size={13} aria-hidden />}
                  >
                    Yangilash
                  </Button>
                ) : undefined
              }
            />

            <CardBody className="space-y-4">
              <Select
                label="Onlayn haydovchini tanlang"
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                placeholder={drivers.length === 0 ? 'Onlayn haydovchi yoʻq' : 'Haydovchi tanlang'}
                disabled={drivers.length === 0}
                hint="Roʻyxatda hozir onlayn boʻlgan haydovchilar koʻrinadi"
                options={drivers.map((d) => ({
                  value: d.id,
                  label: `${d.name || 'Ism kiritilmagan'} — ${formatPhone(d.phone)}`,
                }))}
              />

              {progressError ? (
                <ErrorState
                  compact
                  title={progressError}
                  onRetry={
                    selectedDriverId ? () => loadProgress(selectedDriverId) : undefined
                  }
                />
              ) : progressLoading ? (
                <div className="space-y-2" aria-busy="true">
                  <Skeleton className="h-16 rounded-ds-md" />
                  <Skeleton className="h-16 rounded-ds-md" />
                </div>
              ) : !selectedDriverId ? (
                <EmptyState
                  compact
                  icon={<Users aria-hidden />}
                  title="Haydovchi tanlanmagan"
                  description="Progressni koʻrish uchun yuqoridan haydovchini tanlang."
                />
              ) : progress.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Gift aria-hidden />}
                  title="Bu haydovchi uchun faol qoida yoʻq"
                  description="Faol bonus qoidalari mavjud emas."
                />
              ) : (
                <div className="space-y-2">
                  {progress.map((p) => {
                    const percent = Math.min(
                      100,
                      Math.round((p.currentCount / p.tripThreshold) * 100)
                    );
                    const done = p.currentCount >= p.tripThreshold;
                    return (
                      <div
                        key={p.ruleId}
                        className="rounded-ds-md border border-line bg-surface-2/50 px-3.5 py-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="text-ink font-medium truncate">{p.name}</span>
                          <span className="num text-muted shrink-0">
                            {p.currentCount} / {p.tripThreshold}
                          </span>
                        </div>
                        <div
                          className="h-1.5 rounded-full bg-surface-3 overflow-hidden"
                          role="progressbar"
                          aria-valuenow={percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${p.name} progressi`}
                        >
                          <div
                            className={`h-full rounded-full transition-[width] ${
                              done ? 'bg-primary' : 'bg-mint-deep'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <p className="num text-xs text-subtle">
                          {done
                            ? `Maqsadga yetdi — ${formatMoney(p.bonusAmount)} bonus`
                            : `Yana ${p.tripThreshold - p.currentCount} safar · ${formatMoney(
                                p.bonusAmount
                              )}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
    </PageBody>
  );
}
