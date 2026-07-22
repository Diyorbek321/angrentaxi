'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { getDispatchOverrides, getSosTodaySummary, DispatchOverride } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ShiftReportPage() {
  const [overrides, setOverrides] = useState<DispatchOverride[]>([]);
  const [sos, setSos] = useState<{ resolvedToday: number; stillOpen: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [overridesResult, sosResult] = await Promise.all([
        getDispatchOverrides(1, 100),
        getSosTodaySummary(),
      ]);
      setOverrides(overridesResult.overrides);
      setSos(sosResult);
    } catch (err) {
      console.error('Failed to load shift report:', err);
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
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="px-6 py-4 border-b border-white/[0.06] bg-[#0D1526]/50 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F1F5F9]">Shift Report</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">Today&apos;s exception-handling activity</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw size={13} />}>
          Refresh
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <ShieldQuestion size={16} />
                <span className="text-xs text-gray-500">Manual overrides today</span>
              </div>
              <p className="text-2xl font-bold text-gray-100">{overridesToday.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                {overridesToday.length > 5
                  ? 'Higher than usual — worth a quick review'
                  : 'Every one is reason-logged in the audit trail'}
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <ShieldAlert size={16} />
                <span className="text-xs text-gray-500">SOS resolved today</span>
              </div>
              <p className="text-2xl font-bold text-gray-100">{sos?.resolvedToday ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">
                {sos && sos.stillOpen > 0 ? `${sos.stillOpen} still open` : 'None currently open'}
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <span className="text-xs text-gray-500">Total exceptions today</span>
              </div>
              <p className="text-2xl font-bold text-gray-100">
                {overridesToday.length + (sos?.resolvedToday ?? 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Overrides + resolved SOS alerts</p>
            </Card>
          </div>
        )}

        <Card padding="none">
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-gray-100">Today&apos;s overrides</h2>
          </div>
          {overridesToday.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">No manual overrides yet today</div>
          ) : (
            <div className="divide-y divide-gray-700">
              {overridesToday.map((o) => (
                <div key={o.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-mono text-xs text-gray-400">#{o.orderId.slice(-6).toUpperCase()}</span>
                    <p className="text-gray-300 mt-0.5">{o.reason}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(o.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
