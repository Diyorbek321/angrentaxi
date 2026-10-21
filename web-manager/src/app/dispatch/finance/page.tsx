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
import { t } from '@/locales';

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

// The queue's working set first: pending is what an operator watches.
function statusTabs(): readonly { value: StatusFilter; label: string }[] {
  const m = t();
  const s = m.drivers.financePage.status;
  return [
    { value: '', label: m.common.all },
    { value: 'pending', label: s.pending },
    { value: 'approved', label: s.approved },
    { value: 'paid', label: s.paid },
    { value: 'rejected', label: s.rejected },
  ];
}

function requesterName(w: WithdrawalRequest): string {
  return [w.driver?.firstName, w.driver?.lastName].filter(Boolean).join(' ') || '—';
}

export default function FinancePage() {
  const m = t();
  const fp = m.drivers.financePage;
  const statusLabel: Record<WithdrawalStatus, string> = fp.status;
  const ownerTypeLabel: Record<string, string> = fp.ownerType;
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
      setError(fp.loadError);
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
      [fp.csv.requester, fp.csv.phone, fp.csv.type, fp.csv.amount, fp.csv.destination, fp.csv.requestedAt, fp.csv.status],
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
      title: fp.exported(rows.length),
      description: m.drivers.list.exportedDesc,
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
          title: fp.emptyPending,
          description: fp.emptyPendingDesc,
          action: (
            <Button variant="secondary" size="sm" onClick={() => setStatusFilter('')}>
              {fp.allRequests}
            </Button>
          ),
        }
      : statusFilter
      ? {
          variant: 'no-results',
          title: fp.emptyStatus(statusLabel[statusFilter]),
          description: fp.emptyStatusDesc,
          onClearFilters: () => setStatusFilter(''),
        }
      : {
          variant: 'first-use',
          icon: <Wallet aria-hidden />,
          title: fp.emptyFirst,
          description: fp.emptyFirstDesc,
        };

  const columns: DataTableColumn<WithdrawalRequest>[] = [
    {
      key: 'requester',
      header: fp.col.requester,
      cell: (w) => (
        <div className="min-w-0">
          <p className="text-ink font-medium truncate">{requesterName(w)}</p>
          {w.driver?.phone && <p className="num text-subtle text-xs">{formatPhone(w.driver.phone)}</p>}
        </div>
      ),
    },
    {
      key: 'type',
      header: fp.col.type,
      hideBelow: 'md',
      cell: (w) => (
        <Badge variant="neutral" size="sm">
          {ownerTypeLabel[w.ownerType] ?? w.ownerType}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: fp.col.amount,
      numeric: true,
      cell: (w) => <MoneyText value={w.amount} className="font-semibold text-ink" />,
    },
    {
      key: 'destination',
      header: fp.col.destination,
      hideBelow: 'lg',
      cell: (w) => <span className="font-mono text-xs text-muted">{w.payoutDestination || '—'}</span>,
    },
    {
      key: 'requestedAt',
      header: fp.col.requestedAt,
      className: 'num text-muted whitespace-nowrap',
      cell: (w) => formatDateTime(w.requestedAt),
    },
    {
      key: 'status',
      header: fp.col.status,
      cell: (w) => (
        <Badge variant={statusVariant[w.status]} size="sm" dot>
          {statusLabel[w.status] ?? w.status}
        </Badge>
      ),
    },
  ];

  const chips = statusFilter
    ? [{ key: 'status', label: m.drivers.list.chipStatus(statusLabel[statusFilter]), onRemove: () => setStatusFilter('') }]
    : [];

  return (
    <PageBody>
      <PageHeader
        title={fp.title}
        description={fp.description}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={rows.length === 0}
              leftIcon={<Download size={13} aria-hidden />}
              title={m.drivers.list.exportTitle}
            >
              {m.drivers.list.export}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchData}
              isLoading={isLoading && hasLoadedOnce}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              {m.common.refresh}
            </Button>
          </>
        }
      />

      {/* Read-only surface — approving/paying happens in the admin panel. */}
      <div className="flex items-start gap-2.5 rounded-ds-sm border border-line bg-surface-2/60 px-3 py-2.5 mb-4">
        <Info size={14} className="text-muted shrink-0 mt-0.5" aria-hidden />
        <p className="text-[13px] text-muted leading-relaxed">
          {fp.readOnlyNote}
        </p>
      </div>

      {isLoading && !hasLoadedOnce ? (
        <SkeletonStats count={2} className="mb-4" />
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            label={fp.pendingCount}
            value={formatNumber(pending.length)}
            hint={fp.onPage}
          />
          <StatCard
            label={fp.pendingAmount}
            value={<MoneyText value={totalPendingAmount} />}
            hint={fp.onPage}
          />
        </div>
      )}

      <FilterBar chips={chips} onClearAll={() => setStatusFilter('')} className="mb-3">
        <SegmentedControl
          items={statusTabs()}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel={m.drivers.list.statusFilterAria}
        />
      </FilterBar>

      <DataTable
        ariaLabel={fp.tableAria}
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
