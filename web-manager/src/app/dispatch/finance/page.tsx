'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Info, RefreshCw, Wallet } from 'lucide-react';
import { getAllWithdrawals, WithdrawalRequest, WithdrawalStatus } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import type { EmptyStateProps } from '@/components/ui/EmptyState';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { FilterBar } from '@/components/ui/FilterBar';
import { MoneyText } from '@/components/ui/MoneyText';
import { SkeletonStats } from '@/components/ui/Skeleton';
import { PageBody } from '@/components/ui/PageBody';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';

const PAGE_SIZES = [20, 50, 100] as const;

type StatusFilter = '' | WithdrawalStatus;

// One colour, one meaning: amber stays with manual override, so a pending
// payout reads as info and the approved → paid progression stays green.
const statusVariant: Record<WithdrawalStatus, BadgeVariant> = {
  pending: 'info',
  approved: 'success',
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

// The queue's working set first: pending is what an operator watches.
const STATUS_TABS: readonly { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Hammasi' },
  { value: 'pending', label: 'Kutilmoqda' },
  { value: 'approved', label: 'Tasdiqlangan' },
  { value: 'paid', label: 'Toʻlangan' },
  { value: 'rejected', label: 'Rad etilgan' },
];

function requesterName(w: WithdrawalRequest): string {
  return [w.driver?.firstName, w.driver?.lastName].filter(Boolean).join(' ') || '—';
}

export default function FinancePage() {
  const { toast } = useToast();

  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAllWithdrawals(page, pageSize, statusFilter || undefined);
      setWithdrawals(result.withdrawals);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      console.error('Failed to load withdrawals:', err);
      setError('Pul yechish soʻrovlarini yuklab boʻlmadi.');
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, pageSize]);

  // Default sort: newest request first — the queue reads top-down.
  const rows = useMemo(
    () =>
      [...withdrawals].sort(
        (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
      ),
    [withdrawals]
  );

  const pending = rows.filter((w) => w.status === 'pending');
  const totalPendingAmount = pending.reduce((sum, w) => sum + w.amount, 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleExport = () => {
    if (rows.length === 0) return;
    downloadCsv(
      'pul-yechish-sorovlari',
      ['Soʻrovchi', 'Telefon', 'Turi', 'Summa (soʻm)', 'Karta / hisob', 'Soʻralgan vaqt', 'Status'],
      rows.map((w) => [
        requesterName(w),
        w.driver?.phone ? formatPhone(w.driver.phone) : '',
        ownerTypeLabel[w.ownerType] ?? w.ownerType,
        w.amount,
        w.payoutDestination,
        formatDateTime(w.requestedAt, { withYear: true }),
        statusLabel[w.status] ?? w.status,
      ])
    );
    toast({
      title: `${rows.length} ta soʻrov CSV faylga eksport qilindi`,
      description: 'Joriy sahifadagi yozuvlar — filtrlar hisobga olingan.',
      variant: 'success',
    });
  };

  // The cleared queue is a *good* state and says so — it is the one screen
  // where "nothing here" is the outcome the operator is working toward.
  const empty: EmptyStateProps =
    statusFilter === 'pending'
      ? {
          variant: 'cleared',
          icon: <CheckCircle2 aria-hidden />,
          title: 'Barcha soʻrovlar koʻrib chiqildi',
          description: 'Kutayotgan pul yechish soʻrovi qolmadi.',
          action: (
            <Button variant="secondary" size="sm" onClick={() => setStatusFilter('')}>
              Barcha soʻrovlar
            </Button>
          ),
        }
      : statusFilter
      ? {
          variant: 'no-results',
          title: `«${statusLabel[statusFilter]}» holatidagi soʻrov yoʻq`,
          description: 'Boshqa statusni tanlab koʻring.',
          onClearFilters: () => setStatusFilter(''),
        }
      : {
          variant: 'first-use',
          icon: <Wallet aria-hidden />,
          title: 'Pul yechish soʻrovi yoʻq',
          description: 'Haydovchi yoki sotuvchi pul yechishni soʻraganda shu navbatda koʻrinadi.',
        };

  const columns: DataTableColumn<WithdrawalRequest>[] = [
    {
      key: 'requester',
      header: 'Soʻrovchi',
      cell: (w) => (
        <div className="min-w-0">
          <p className="text-ink font-medium truncate">{requesterName(w)}</p>
          {w.driver?.phone && <p className="num text-subtle text-xs">{formatPhone(w.driver.phone)}</p>}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Turi',
      hideBelow: 'md',
      cell: (w) => (
        <Badge variant="neutral" size="sm">
          {ownerTypeLabel[w.ownerType] ?? w.ownerType}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Summa',
      numeric: true,
      cell: (w) => <MoneyText value={w.amount} className="font-semibold text-ink" />,
    },
    {
      key: 'destination',
      header: 'Karta / hisob',
      hideBelow: 'lg',
      cell: (w) => <span className="font-mono text-xs text-muted">{w.payoutDestination || '—'}</span>,
    },
    {
      key: 'requestedAt',
      header: 'Soʻralgan vaqt',
      className: 'num text-muted whitespace-nowrap',
      cell: (w) => formatDateTime(w.requestedAt),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (w) => (
        <Badge variant={statusVariant[w.status]} size="sm" dot>
          {statusLabel[w.status] ?? w.status}
        </Badge>
      ),
    },
  ];

  const chips = statusFilter
    ? [{ key: 'status', label: `Status: ${statusLabel[statusFilter]}`, onRemove: () => setStatusFilter('') }]
    : [];

  return (
    <PageBody>
      <PageHeader
        title="Moliya"
        description="Toʻlov navbati — haydovchi, Market sotuvchisi, restoran"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={rows.length === 0}
              leftIcon={<Download size={13} aria-hidden />}
              title="Joriy sahifadagi yozuvlarni CSV sifatida yuklab olish"
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

      {/* Read-only surface — approving/paying happens in the admin panel. */}
      <div className="flex items-start gap-2.5 rounded-ds-sm border border-line bg-surface-2/60 px-3 py-2.5 mb-4">
        <Info size={14} className="text-muted shrink-0 mt-0.5" aria-hidden />
        <p className="text-[13px] text-muted leading-relaxed">
          Bu sahifa faqat kuzatuv uchun. Toʻlovni tasdiqlash, rad etish yoki «toʻlandi» deb
          belgilash Super Admin panelida bajariladi.
        </p>
      </div>

      {isLoading && !hasLoadedOnce ? (
        <SkeletonStats count={2} className="mb-4" />
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            label="Kutilayotgan soʻrovlar"
            value={formatNumber(pending.length)}
            hint="joriy sahifada"
          />
          <StatCard
            label="Kutilayotgan summa"
            value={<MoneyText value={totalPendingAmount} />}
            hint="joriy sahifada"
          />
        </div>
      )}

      <FilterBar chips={chips} onClearAll={() => setStatusFilter('')} className="mb-3">
        <SegmentedControl
          items={STATUS_TABS}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Status boʻyicha filtr"
        />
      </FilterBar>

      <DataTable
        ariaLabel="Pul yechish soʻrovlari"
        columns={columns}
        rows={rows}
        rowKey={(w) => w.id}
        loading={isLoading && !hasLoadedOnce}
        error={error}
        onRetry={fetchData}
        empty={empty}
        maxHeightClassName="max-h-[calc(100vh-22rem)]"
        pagination={{
          page,
          totalPages,
          total,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
          pageSizeOptions: PAGE_SIZES,
        }}
      />
    </PageBody>
  );
}
