'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { RefreshCw, ShieldQuestion } from 'lucide-react';
import { getDispatchOverrides, DispatchOverride } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const PAGE_LIMIT = 20;

export default function AuditLogPage() {
  const [overrides, setOverrides] = useState<DispatchOverride[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOverrides = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getDispatchOverrides(page, PAGE_LIMIT);
      setOverrides(result.overrides);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load dispatch overrides:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="px-6 py-4 border-b border-white/[0.06] bg-[#0D1526]/50 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F1F5F9]">Override Audit Log</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">
            Every manual driver assignment — who did it, and why
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchOverrides} leftIcon={<RefreshCw size={13} />}>
          Refresh
        </Button>
      </div>

      <div className="p-6">
        <Card padding="none">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          ) : overrides.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-center">
              <ShieldQuestion size={28} className="text-gray-600" />
              <p className="text-gray-400 font-medium">No overrides yet</p>
              <p className="text-gray-600 text-sm">
                Every manual assignment/reassignment will show up here.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Previous driver</th>
                      <th className="px-4 py-3">New driver</th>
                      <th className="px-4 py-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {overrides.map((o) => (
                      <tr key={o.id} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {format(new Date(o.createdAt), 'dd MMM, HH:mm')}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">
                          #{o.orderId.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {o.previousDriverId ? `…${o.previousDriverId.slice(-6)}` : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-300">
                          …{o.newDriverId.slice(-6)}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-xs max-w-[320px]">{o.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500 border-t border-gray-700">
                <span>
                  {total} total · page {page} of {Math.max(1, Math.ceil(total / PAGE_LIMIT))}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page * PAGE_LIMIT >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
