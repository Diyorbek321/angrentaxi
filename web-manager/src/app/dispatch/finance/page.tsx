'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, DollarSign, Info, RefreshCw, Wallet } from 'lucide-react';
import { getAllWithdrawals, WithdrawalRequest, WithdrawalStatus } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatTile } from '@/components/ui/StatTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatDateTime, formatMoney, formatNumber, formatPhone } from '@/lib/format';

const PAGE_LIMIT = 20;

const statusVariant: Record<WithdrawalStatus, BadgeVariant> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'danger',
  paid: 'success',
};

const statusLabel: Record<WithdrawalStatus, string> = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
  paid: 'Toʻlangan',
};

const ownerTypeLabel: Record<string, string> = {
  driver: 'Haydovchi',
  vendor: 'Market sotuvchisi',
  restaurant: 'Restoran',
};

const statusOptions = [
  { value: '', label: 'Barcha statuslar' },
  { value: 'pending', label: 'Kutilmoqda' },
  { value: 'approved', label: 'Tasdiqlangan' },
  { value: 'paid', label: 'Toʻlangan' },
  { value: 'rejected', label: 'Rad etilgan' },
];

export default function FinancePage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
    } catch (err) {
      console.error('Failed to load withdrawals:', err);
      setError('Pul yechish soʻrovlarini yuklab boʻlmadi.');
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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4">
        <PageHeader
          title="Moliya"
          description="Toʻlov navbati — haydovchi, Market sotuvchisi, restoran"
          icon={<DollarSign size={17} />}
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

        {/* Read-only surface — approving/paying happens in the admin panel */}
        <div className="flex items-start gap-2.5 rounded-lg border border-info/30 bg-info/[0.08] px-3.5 py-3 mb-4">
          <Info size={15} className="text-info shrink-0 mt-0.5" />
          <p className="text-sm text-info dark:text-blue-300 leading-relaxed">
            Bu sahifa faqat kuzatuv uchun. Toʻlovni tasdiqlash, rad etish yoki «toʻlandi» deb
            belgilash Super Admin panelida bajariladi.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatTile
            label="Kutilayotgan soʻrovlar"
            value={isLoading ? '—' : pending.length}
            tone="override"
            icon={<Wallet size={16} />}
          />
          <StatTile
            label="Kutilayotgan summa"
            value={isLoading ? '—' : formatMoney(totalPendingAmount)}
            tone="mint"
            icon={<DollarSign size={16} />}
          />
        </div>

        <Select
          options={statusOptions}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48 mb-4"
          aria-label="Status boʻyicha filtr"
        />

        {error ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : isLoading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : withdrawals.length === 0 ? (
          <Card>
            <EmptyState
              tone="positive"
              icon={<Wallet size={22} />}
              title="Pul yechish soʻrovi yoʻq"
              description={
                statusFilter ? 'Bu status boʻyicha soʻrov topilmadi.' : 'Navbat boʻsh.'
              }
            />
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 text-subtle uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Soʻrovchi</th>
                    <th className="px-4 py-3 font-semibold">Turi</th>
                    <th className="px-4 py-3 font-semibold">Summa</th>
                    <th className="px-4 py-3 font-semibold">Karta / hisob</th>
                    <th className="px-4 py-3 font-semibold">Soʻralgan vaqt</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-surface-2/70 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-ink font-medium">
                          {[w.driver?.firstName, w.driver?.lastName].filter(Boolean).join(' ') || '—'}
                        </p>
                        <p className="text-subtle text-[11px] font-mono">
                          {w.driver?.phone ? formatPhone(w.driver.phone) : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default" size="sm">
                          {ownerTypeLabel[w.ownerType] ?? w.ownerType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-ink whitespace-nowrap">
                        {formatMoney(w.amount)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {w.payoutDestination}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap">
                        {formatDateTime(w.requestedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[w.status]} size="sm" dot>
                          {statusLabel[w.status] ?? w.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted border-t border-line">
              <span>
                Jami <span className="font-mono">{formatNumber(total)}</span> · {page} / {totalPages}{' '}
                sahifa
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  leftIcon={<ChevronLeft size={13} />}
                >
                  Oldingi
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page * PAGE_LIMIT >= total}
                  onClick={() => setPage((p) => p + 1)}
                  rightIcon={<ChevronRight size={13} />}
                >
                  Keyingi
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
