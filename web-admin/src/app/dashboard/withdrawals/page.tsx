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

// Pending = waiting on an admin's decision (amber); approved = info; paid = done.
const statusBadgeVariant: Record<WithdrawalStatus, BadgeVariant> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'danger',
  paid: 'success',
};

const statusLabel: Record<WithdrawalStatus, string> = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
  paid: "To'langan",
};

const ownerTypeLabel: Record<string, string> = {
  driver: 'Haydovchi',
  vendor: 'Market sotuvchi',
  restaurant: 'Restoran',
};

type Action = 'approved' | 'rejected' | 'paid';
type StatusFilter = WithdrawalStatus | 'all';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Kutilmoqda' },
  { value: 'approved', label: 'Tasdiqlangan' },
  { value: 'paid', label: "To'langan" },
  { value: 'rejected', label: 'Rad etilgan' },
  { value: 'all', label: 'Barchasi' },
];

const requesterName = (w: WithdrawalRequest) => fullName(w.driver?.firstName, w.driver?.lastName);

export default function WithdrawalsPage() {
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
      setError("Pul yechish so'rovlarini yuklab bo'lmadi");
      toast({ title: 'Xatolik', description: "Pul yechish so'rovlarini yuklashda xatolik", variant: 'error' });
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
            ? "So'rov tasdiqlandi"
            : action === 'rejected'
            ? "So'rov rad etildi — summa hamyonga qaytadi"
            : "To'langan deb belgilandi",
        description: `${formatMoney(target.amount)} · ${requesterName(target)}`,
        variant: 'success',
      });
      closeAction();
      fetchWithdrawals();
    } catch {
      toast({ title: 'Xatolik', description: 'Amalni bajarishda xatolik', variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (withdrawals.length === 0) return;
    downloadCsv<WithdrawalRequest>(
      `pul-yechish-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: "So'rov beruvchi", value: (w) => requesterName(w) },
        { header: 'Telefon', value: (w) => w.driver?.phone ?? '' },
        { header: 'Turi', value: (w) => ownerTypeLabel[w.ownerType] ?? w.ownerType },
        { header: 'Summa', value: (w) => w.amount },
        { header: "To'lov manzili", value: (w) => w.payoutDestination },
        { header: 'Holat', value: (w) => statusLabel[w.status] },
        { header: "So'ralgan sana", value: (w) => formatDate(w.requestedAt) },
        { header: 'Izoh', value: (w) => w.adminNote ?? '' },
      ],
      withdrawals
    );
    toast({ title: 'CSV yuklab olindi', description: `${withdrawals.length} ta qator`, variant: 'success' });
  };

  // Approve = primary; reject = destructive; "paid" = manual off-system transfer → override (amber).
  const confirmButtonVariant = action === 'rejected' ? 'danger' : action === 'paid' ? 'override' : 'primary';

  const columns: DataTableColumn<WithdrawalRequest>[] = [
    {
      key: 'requester',
      header: "So'rov beruvchi",
      cell: (w) => (
        <div className="min-w-0 leading-tight">
          <p className="font-medium text-ink truncate">{requesterName(w)}</p>
          <p className="num text-xs text-muted whitespace-nowrap">{formatPhone(w.driver?.phone)}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Turi',
      hideBelow: 'xl',
      cell: (w) => <Badge variant="neutral">{ownerTypeLabel[w.ownerType] ?? w.ownerType}</Badge>,
    },
    {
      key: 'amount',
      header: 'Summa',
      numeric: true,
      cell: (w) => <MoneyText value={w.amount} className="font-semibold" />,
    },
    {
      key: 'destination',
      header: "To'lov manzili",
      cell: (w) => <span className="font-mono text-xs text-muted whitespace-nowrap">{w.payoutDestination}</span>,
    },
    {
      key: 'status',
      header: 'Holat',
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
      header: 'Sana',
      hideBelow: 'xl',
      cell: (w) => <span className="num text-muted whitespace-nowrap">{formatDateTime(w.requestedAt)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amallar</span>,
      align: 'right',
      cell: (w) => (
        <div className="flex justify-end gap-1.5 whitespace-nowrap">
          {w.status === 'pending' && (
            <>
              <Button size="sm" variant="primary" onClick={() => openAction(w, 'approved')}>
                Tasdiqlash
              </Button>
              <Button size="sm" variant="danger-ghost" onClick={() => openAction(w, 'rejected')}>
                Rad etish
              </Button>
            </>
          )}
          {w.status === 'approved' && (
            <Button size="sm" variant="override" onClick={() => openAction(w, 'paid')}>
              To&apos;landi deb belgilash
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
          title: "Navbat bo'sh",
          description: "Barcha pul yechish so'rovlari ko'rib chiqilgan. Yangi so'rov kelganda shu yerda ko'rinadi.",
        }
      : {
          variant: statusFilter === 'all' ? 'first-use' : 'no-results',
          icon: <Wallet aria-hidden />,
          title: "So'rovlar topilmadi",
          description:
            statusFilter === 'all'
              ? "Hozircha pul yechish so'rovlari yo'q."
              : `"${STATUS_TABS.find((t) => t.value === statusFilter)?.label}" holatida so'rov yo'q.`,
          onClearFilters: statusFilter !== 'all' ? () => changeFilter('all') : undefined,
        };

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Pul yechish"
        description="Haydovchi, Market va Eats — barcha to'lov so'rovlari bitta navbatda"
        actions={
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={withdrawals.length === 0}
            leftIcon={<Download size={14} aria-hidden />}
          >
            CSV eksport
          </Button>
        }
      />

      <DataTable
        ariaLabel="Pul yechish so'rovlari"
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
            ariaLabel="Holat bo'yicha filtr"
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
            ? "So'rovni tasdiqlash"
            : action === 'rejected'
            ? "So'rovni rad etish"
            : "To'langan deb belgilash"
        }
        description={
          action === 'approved'
            ? "Pul haligacha o'tkazilmagan — haqiqatda o'tkazgach, \"To'langan\" deb belgilang."
            : action === 'rejected'
            ? "Ushlab turilgan summa hamyonga qaytariladi."
            : "Faqat pulni haqiqatda (karta/bank orqali) o'tkazgandan keyin bosing — avtomatik to'lov yo'q."
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeAction} disabled={actionLoading}>
              Bekor qilish
            </Button>
            <Button variant={confirmButtonVariant} isLoading={actionLoading} onClick={handleConfirm}>
              {action === 'approved' && target
                ? `Tasdiqlash — ${formatMoney(target.amount)}`
                : action === 'rejected'
                ? 'Rad etish'
                : "To'landi deb belgilash"}
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
          label="Izoh (ixtiyoriy)"
          placeholder={action === 'rejected' ? 'Rad etish sababi…' : "Masalan: Click orqali o'tkazildi"}
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}
