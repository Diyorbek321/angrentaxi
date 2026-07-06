'use client';

import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { getBonusRules, getDriverBonusProgress, DriverBonusRule, DriverBonusProgress } from '@/lib/api';
import { useOnlineDrivers } from '@/hooks/useOnlineDrivers';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';

const ruleTypeLabel: Record<DriverBonusRule['ruleType'], string> = {
  trip_count: 'Safar soni',
  weekly_goal: 'Haftalik maqsad',
};

export default function BonusesPage() {
  const [rules, setRules] = useState<DriverBonusRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [progress, setProgress] = useState<DriverBonusProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);

  const { drivers } = useOnlineDrivers();

  useEffect(() => {
    getBonusRules()
      .then(setRules)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedDriverId) {
      setProgress([]);
      return;
    }
    setProgressLoading(true);
    getDriverBonusProgress(selectedDriverId)
      .then(setProgress)
      .finally(() => setProgressLoading(false));
  }, [selectedDriverId]);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#F1F5F9]">Haydovchi bonuslari</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">
          Faol bonus qoidalari va haydovchi progressi (qoidalarni faqat admin qo&apos;sha oladi)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Faol bonus qoidalari</CardTitle>
        </CardHeader>
        {isLoading ? (
          <p className="text-sm text-[#94A3B8]">Yuklanmoqda...</p>
        ) : rules.filter((r) => r.status === 'active').length === 0 ? (
          <p className="text-sm text-[#94A3B8]">Hozircha faol bonus qoidasi yo&apos;q</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules
              .filter((r) => r.status === 'active')
              .map((rule) => (
                <div key={rule.id} className="rounded-lg border border-white/[0.08] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[#F1F5F9] flex items-center gap-1.5">
                      <Gift size={14} className="text-[#FACC15]" />
                      {rule.name}
                    </p>
                    <Badge variant="info">{ruleTypeLabel[rule.ruleType]}</Badge>
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    Har {rule.tripThreshold} safar uchun {rule.bonusAmount.toLocaleString()} so&apos;m
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
            placeholder="Haydovchi tanlang"
            options={drivers.map((d) => ({ value: d.id, label: `${d.name} — ${d.phone}` }))}
          />
          {progressLoading ? (
            <p className="text-sm text-[#94A3B8]">Yuklanmoqda...</p>
          ) : selectedDriverId && progress.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">Faol bonus qoidalari mavjud emas</p>
          ) : (
            <div className="space-y-2">
              {progress.map((p) => (
                <div
                  key={p.ruleId}
                  className="rounded-lg border border-white/[0.08] px-4 py-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#F1F5F9]">{p.name}</span>
                    <span className="text-[#94A3B8]">
                      {p.currentCount} / {p.tripThreshold}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      className="h-full bg-[#FACC15] rounded-full"
                      style={{
                        width: `${Math.min(100, (p.currentCount / p.tripThreshold) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
