'use client';

import { useEffect, useState } from 'react';
import { Gift, Users } from 'lucide-react';
import {
  getBonusRules,
  getDriverBonusProgress,
  DriverBonusRule,
  DriverBonusProgress,
} from '@/lib/api';
import { useDispatchData } from '@/components/dispatch/DispatchDataContext';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney, formatNumber, formatPhone } from '@/lib/format';

const ruleTypeLabel: Record<DriverBonusRule['ruleType'], string> = {
  trip_count: 'Safar soni',
  weekly_goal: 'Haftalik maqsad',
};

export default function BonusesPage() {
  const [rules, setRules] = useState<DriverBonusRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
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
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadRules();
  }, []);

  useEffect(() => {
    if (!selectedDriverId) {
      setProgress([]);
      setProgressError(null);
      return;
    }
    setProgressLoading(true);
    getDriverBonusProgress(selectedDriverId)
      .then((p) => {
        setProgress(p);
        setProgressError(null);
      })
      .catch(() => setProgressError('Haydovchi progressini yuklab boʻlmadi.'))
      .finally(() => setProgressLoading(false));
  }, [selectedDriverId]);

  const activeRules = rules.filter((r) => r.status === 'active');

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-5xl mx-auto">
        <PageHeader
          title="Bonuslar"
          description="Faol bonus qoidalari va haydovchi progressi (qoidalarni faqat admin qoʻsha oladi)"
          icon={<Gift size={17} />}
        />

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Faol bonus qoidalari</CardTitle>
              {activeRules.length > 0 && (
                <Badge variant="mint-soft" size="sm">
                  {activeRules.length}
                </Badge>
              )}
            </CardHeader>

            {rulesError ? (
              <ErrorState compact message={rulesError} onRetry={loadRules} />
            ) : isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : activeRules.length === 0 ? (
              <EmptyState
                compact
                icon={<Gift size={20} />}
                title="Faol bonus qoidasi yoʻq"
                description="Yangi qoidalar admin panelida qoʻshiladi."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-xl border border-line bg-surface-2/50 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-ink flex items-center gap-1.5 min-w-0">
                        <Gift size={14} className="text-primary shrink-0" />
                        <span className="truncate">{rule.name}</span>
                      </p>
                      <Badge variant="info" size="sm">
                        {ruleTypeLabel[rule.ruleType]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted">
                      Har <span className="font-mono">{formatNumber(rule.tripThreshold)}</span> safar
                      uchun{' '}
                      <span className="font-mono text-primary-700 dark:text-primary-300">
                        {formatMoney(rule.bonusAmount)}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Haydovchi progressi</CardTitle>
            </CardHeader>

            <div className="space-y-4">
              <Select
                label="Onlayn haydovchini tanlang"
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                placeholder={
                  drivers.length === 0 ? 'Onlayn haydovchi yoʻq' : 'Haydovchi tanlang'
                }
                disabled={drivers.length === 0}
                options={drivers.map((d) => ({
                  value: d.id,
                  label: `${d.name} — ${formatPhone(d.phone)}`,
                }))}
              />

              {progressError ? (
                <ErrorState compact message={progressError} />
              ) : progressLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </div>
              ) : !selectedDriverId ? (
                <EmptyState
                  compact
                  icon={<Users size={20} />}
                  title="Haydovchi tanlanmagan"
                  description="Progressni koʻrish uchun yuqoridan haydovchini tanlang."
                />
              ) : progress.length === 0 ? (
                <EmptyState
                  compact
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
                        className="rounded-xl border border-line bg-surface-2/50 px-4 py-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-ink font-medium truncate">{p.name}</span>
                          <span className="font-mono text-muted shrink-0">
                            {p.currentCount} / {p.tripThreshold}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-[width] ${
                              done ? 'bg-primary-700' : 'bg-primary'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-subtle">
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
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
