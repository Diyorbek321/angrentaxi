'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, Wallet } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import type { EmptyStateProps } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { MoneyText } from '@/components/ui/MoneyText';
import { withdrawalsApi, WithdrawalRequest, WithdrawalStatus } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatDate } from '@/lib/utils';
import { formatDateTime, formatMoney, formatPhone, fullName } from '@/lib/format';
import { t } from '@/locales';

// Pending = waiting on an admin's decision (amber); approved = info; paid = done.
const statusBadgeVariant: Record<WithdrawalStatus, BadgeVariant> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'danger',
  paid: 'success',
};

type Action = 'approved' | 'rejected' | 'paid';
type StatusFilter = WithdrawalStatus | 'all';

const requesterName = (w: WithdrawalRequest) => fullName(w.driver?.firstName, w.driver?.lastName);

export default function WithdrawalsPage() {
  const m = t();
  const w$ = m.finance.withdrawals;
  const statusLabel = w$.status;
  const ownerTypeLabel: Record<string, string> = w$.ownerType;
  const STATUS_TABS: { value: StatusFilter; label: string }[] = [
    { value: 'pending', label: statusLabel.pending },
    { value: 'approved', label: statusLabel.approved },
    { value: 'paid', label: statusLabel.paid },
    { value: 'rejected', label: statusLabel.rejected },
    { value: 'all', label: m.common.allAlt },
  ];
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Queue page: the default view is what still WAITS for a decision.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [target, setTarget] = useState<WithdrawalRequest | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await withdrawalsApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      const payload = res.data.data;
      setWithdrawals(payload?.withdrawals ?? []);
      const total = payload?.total ?? 0;
      pagination.setTotal(total, Math.ceil(total / pagination.limit));
      setError(null);
    } catch {
      // Last good rows stay on screen; DataTable shows banner + retry.
      setError(w$.loadError);
      toast({ title: m.common.error, description: w$.loadErrorToast, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, statusFilter]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const openAction = (withdrawal: WithdrawalRequest, next: Action) => {
    setTarget(withdrawal);
    setAction(next);
    setAdminNote('');
  };

  const closeAction = () => {
    setTarget(null);
    setAction(null);
    setAdminNote('');
  };

  const changeFilter = (v: StatusFilter) => {
    setStatusFilter(v);
    pagination.reset();
  };

  const handleConfirm = async () => {
    if (!target || !action) return;
    setActionLoading(true);
    try {
      await withdrawalsApi.process(target.id, action, adminNote.trim() || undefined);
      toast({
        title:
          action === 'approved'
            ? w$.toastApproved
            : action === 'rejected'
            ? w$.toastRejected
            : w$.toastPaid,
        description: `${formatMoney(target.amount)} · ${requesterName(target)}`,
        variant: 'success',
      });
      closeAction();
      fetchWithdrawals();
    } catch {
      toast({ title: m.common.error, description: m.common.actionFailed, variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (withdrawals.length === 0) return;
    downloadCsv<WithdrawalRequest>(
      `pul-yechish-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: w$.col.requester, value: (w) => requesterName(w) },
        { header: w$.col.phone, value: (w) => w.driver?.phone ?? '' },
        { header: w$.col.type, value: (w) => ownerTypeLabel[w.ownerType] ?? w.ownerType },
        { header: w$.col.amount, value: (w) => w.amount },
        { header: w$.col.destination, value: (w) => w.payoutDestination },
        { header: w$.col.status, value: (w) => statusLabel[w.status] },
        { header: w$.col.requestedAt, value: (w) => formatDate(w.requestedAt) },
        { header: w$.col.note, value: (w) => w.adminNote ?? '' },
      ],
      withdrawals
    );
    toast({ title: m.finance.csvDownloaded, description: m.finance.csvRows(withdrawals.length), variant: 'success' });
  };

  // Approve = primary; reject = destructive; "paid" = manual off-system transfer → override (amber).
  const confirmButtonVariant = action === 'rejected' ? 'danger' : action === 'paid' ? 'override' : 'primary';

  const columns: DataTableColumn<WithdrawalRequest>[] = [
    {
      key: 'requester',
      header: w$.col.requester,
      cell: (w) => (
        <div className="min-w-0 leading-tight">
          <p className="font-medium text-ink truncate">{requesterName(w)}</p>
          <p className="num text-xs text-muted whitespace-nowrap">{formatPhone(w.driver?.phone)}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: w$.col.type,
      hideBelow: 'xl',
      cell: (w) => <Badge variant="neutral">{ownerTypeLabel[w.ownerType] ?? w.ownerType}</Badge>,
    },
    {
      key: 'amount',
      header: w$.col.amount,
      numeric: true,
      cell: (w) => <MoneyText value={w.amount} className="font-semibold" />,
    },
    {
      key: 'destination',
      header: w$.col.destination,
      cell: (w) => <span className="font-mono text-xs text-muted whitespace-nowrap">{w.payoutDestination}</span>,
    },
    {
      key: 'status',
      header: w$.col.status,
      cell: (w) => (
        <div className="min-w-0">
          <Badge variant={statusBadgeVariant[w.status]} dot>
            {statusLabel[w.status]}
          </Badge>
          {w.adminNote && (
            <p className="mt-0.5 max-w-[200px] truncate text-xs text-subtle" title={w.adminNote}>
              {w.adminNote}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'requestedAt',
      header: w$.col.date,
      hideBelow: 'xl',
      cell: (w) => <span className="num text-muted whitespace-nowrap">{formatDateTime(w.requestedAt)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">{m.common.actions}</span>,
      align: 'right',
      cell: (w) => (
        <div className="flex justify-end gap-1.5 whitespace-nowrap">
          {w.status === 'pending' && (
            <>
              <Button size="sm" variant="primary" onClick={() => openAction(w, 'approved')}>
                {m.common.confirm}
              </Button>
              <Button size="sm" variant="danger-ghost" onClick={() => openAction(w, 'rejected')}>
                {w$.reject}
              </Button>
            </>
          )}
          {w.status === 'approved' && (
            <Button size="sm" variant="override" onClick={() => openAction(w, 'paid')}>
              {w$.markPaid}
            </Button>
          )}
        </div>
      ),
    },
  ];

  const empty: EmptyStateProps =
    statusFilter === 'pending'
      ? {
          variant: 'cleared',
          icon: <CheckCircle2 aria-hidden />,
          title: w$.emptyQueueTitle,
          description: w$.emptyQueueDesc,
        }
      : {
          variant: statusFilter === 'all' ? 'first-use' : 'no-results',
          icon: <Wallet aria-hidden />,
          title: w$.notFoundTitle,
          description:
            statusFilter === 'all'
              ? w$.noneYet
              : w$.noneInStatus(STATUS_TABS.find((s) => s.value === statusFilter)?.label ?? ''),
          onClearFilters: statusFilter !== 'all' ? () => changeFilter('all') : undefined,
        };

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={w$.title}
        description={w$.description}
        actions={
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={withdrawals.length === 0}
            leftIcon={<Download size={14} aria-hidden />}
          >
            {m.finance.csvExport}
          </Button>
        }
      />

      <DataTable
        ariaLabel={w$.tableAria}
        columns={columns}
        rows={withdrawals}
        rowKey={(w) => w.id}
        loading={isLoading}
        error={error}
        onRetry={fetchWithdrawals}
        empty={empty}
        maxHeightClassName="max-h-[calc(100vh-260px)]"
        toolbar={
          <SegmentedControl
            ariaLabel={m.common.statusFilter}
            items={STATUS_TABS}
            value={statusFilter}
            onChange={(v) => changeFilter(v as StatusFilter)}
          />
        }
        pagination={{
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          totalPages: pagination.totalPages,
          pageRange: pagination.pageRange,
          canGoPrev: pagination.canGoPrev,
          canGoNext: pagination.canGoNext,
          onPageChange: pagination.goToPage,
          onLimitChange: pagination.setLimit,
        }}
      />

      {/* Financial action — always an explicit confirmation: amount shown again, consequence named. */}
      <Modal
        isOpen={!!action}
        onClose={closeAction}
        tone={action === 'rejected' ? 'danger' : action === 'paid' ? 'override' : 'default'}
        title={
          action === 'approved'
            ? w$.modalApproveTitle
            : action === 'rejected'
            ? w$.modalRejectTitle
            : w$.modalPaidTitle
        }
        description={
          action === 'approved'
            ? w$.modalApproveDesc
            : action === 'rejected'
            ? w$.modalRejectDesc
            : w$.modalPaidDesc
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeAction} disabled={actionLoading}>
              {m.common.cancel}
            </Button>
            <Button variant={confirmButtonVariant} isLoading={actionLoading} onClick={handleConfirm}>
              {action === 'approved' && target
                ? w$.confirmApprove(formatMoney(target.amount))
                : action === 'rejected'
                ? w$.reject
                : w$.markPaid}
            </Button>
          </>
        }
      >
        {target && (
          <div className="mb-4 rounded-ds-md border border-line bg-surface-2 px-3 py-2.5">
            <p className="text-xs text-muted">
              {requesterName(target)} · {ownerTypeLabel[target.ownerType] ?? target.ownerType}
            </p>
            <MoneyText value={target.amount} className="mt-1 block text-h2 font-semibold text-ink" />
            <p className="mt-1 font-mono text-xs text-subtle">{target.payoutDestination}</p>
          </div>
        )}
        <Input
          label={w$.noteLabel}
          placeholder={action === 'rejected' ? w$.rejectReasonPh : w$.notePh}
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}
