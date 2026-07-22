'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Info, RefreshCw } from 'lucide-react';
import { getAllWithdrawals, WithdrawalRequest, WithdrawalStatus } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';

const PAGE_LIMIT = 20;

const statusVariant: Record<WithdrawalStatus, BadgeVariant> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'danger',
  paid: 'success',
};

const ownerTypeLabel: Record<string, string> = {
  driver: 'Driver',
  vendor: 'Market vendor',
  restaurant: 'Eats restaurant',
};

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];

export default function FinancePage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAllWithdrawals(
        page,
        PAGE_LIMIT,
        (statusFilter || undefined) as WithdrawalStatus | undefined
      );
      setWithdrawals(result.withdrawals);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load withdrawals:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const pending = withdrawals.filter((w) => w.status === 'pending');
  const totalPendingAmount = pending.reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="px-6 py-4 border-b border-white/[0.06] bg-[#0D1526]/50 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F1F5F9]">Finance</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">Payout queue — driver, Market vendor, Eats restaurant</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw size={13} />}>
          Refresh
        </Button>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
          <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-200">
            Oversight only — this view is read-only. Approving, rejecting, or marking payouts
            paid happens in the Super Admin panel.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-xs text-gray-500">Pending requests</p>
            <p className="text-xl font-bold text-gray-100 mt-1">{pending.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray-500">Pending amount</p>
            <p className="text-xl font-bold text-gray-100 mt-1">{totalPendingAmount.toLocaleString()} UZS</p>
          </Card>
        </div>

        <Select
          options={statusOptions}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
        />

        <Card padding="none">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">No withdrawal requests</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Requester</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Destination</th>
                      <th className="px-4 py-3">Requested</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="bg-gray-900">
                        <td className="px-4 py-3">
                          <p className="text-gray-100 font-medium">
                            {[w.driver?.firstName, w.driver?.lastName].filter(Boolean).join(' ') || '—'}
                          </p>
                          <p className="text-gray-500 text-xs">{w.driver?.phone ?? ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="default">{ownerTypeLabel[w.ownerType] ?? w.ownerType}</Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-100">
                          {w.amount.toLocaleString()} UZS
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{w.payoutDestination}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {format(new Date(w.requestedAt), 'dd MMM, HH:mm')}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant[w.status]} size="sm">{w.status}</Badge>
                        </td>
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
