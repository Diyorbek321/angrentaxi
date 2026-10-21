'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Timer } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFilter, rangeForPreset, type DateRangeValue } from '@/components/ui/DateRangeFilter';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { usePagination } from '@/hooks/usePagination';
import { useResource } from '@/hooks/useResource';
import { shiftPassesApi, type AdminShiftPass } from '@/lib/compliance-api';
import { apiErrorMessage, dateRangeToIso, estimateShiftRefund } from '@/lib/compliance';
import { labelOf, serviceTypeLabels, SHIFT_STATUS_BADGE, shiftStatusLabels } from '@/lib/compliance-labels';
import { formatDateTime, formatMoney, formatNumber, formatPhone, nameFallback } from '@/lib/format';
import { t } from '@/locales';

const DEFAULT_RANGE: DateRangeValue = { preset: '30d', ...rangeForPreset('30d') };

/** Haydovchi smenalari (kunlik obuna) — LEGAL-COMPLIANCE §8, §15. */
export default function ShiftPassesPage() {
  const m = t();
  const s$ = m.finance.shiftPasses;
  const SERVICE_TYPE_LABELS = serviceTypeLabels();
  const SHIFT_STATUS_LABELS = shiftStatusLabels();
  const { toast } = useToast();
  const [range, setRange] = useState<DateRangeValue>(DEFAULT_RANGE);
  const [target, setTarget] = useState<AdminShiftPass | null>(null);
  const [refund, setRefund] = useState(true);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const pagination = usePagination(50);

  const res = useResource(
    () =>
      shiftPassesApi
        .list({ ...dateRangeToIso(range), page: pagination.page, limit: pagination.limit })
        .then((r) => r.data.data),
    s$.loadError,
    [range, pagination.page, pagination.limit]
  );
  const data = res.data;
  const { setTotal } = pagination;

  // Server-side pagination (§22): `total` drives the kit Pagination.
  useEffect(() => {
    if (!data) return;
    setTotal(data.total, Math.max(1, Math.ceil(data.total / Math.max(1, data.limit))));
  }, [data, setTotal]);

  const changeRange = (next: DateRangeValue) => {
    setRange(next);
    pagination.reset();
  };
  const statsLoading = res.loading && !res.hasLoaded;

  const openCancel = (p: AdminShiftPass) => {
    setTarget(p);
    setRefund(p.status === 'active');
    setReason('');
  };

  const confirmCancel = async () => {
    if (!target || !reason.trim()) return;
    setCancelling(true);
    try {
      const r = await shiftPassesApi.cancel(target.id, { refund, reason: reason.trim() });
      const refunded = r.data.data.refundAmount ?? 0;
      toast({
        title: s$.cancelled,
        description: refunded > 0 ? s$.refunded(formatMoney(refunded)) : s$.notRefunded,
        variant: 'success',
      });
      setTarget(null);
      void res.reload();
    } catch (err) {
      toast({ title: m.common.error, description: apiErrorMessage(err, s$.cancelError), variant: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  const columns: DataTableColumn<AdminShiftPass>[] = [
    {
      key: 'driver',
      header: s$.col.driver,
      cell: (p) => (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-medium text-ink">{p.driverName?.trim() || nameFallback()}</p>
          <p className="num whitespace-nowrap text-xs text-muted">{formatPhone(p.driverPhone)}</p>
        </div>
      ),
    },
    {
      key: 'period',
      header: s$.col.period,
      cell: (p) => (
        <div className="num whitespace-nowrap text-xs leading-tight">
          <p className="text-ink">{formatDateTime(p.startsAt)}</p>
          <p className="text-muted">→ {formatDateTime(p.endsAt)}</p>
        </div>
      ),
    },
    {
      key: 'services',
      header: s$.col.services,
      hideBelow: 'xl',
      cell: (p) => (
        <span className="text-muted">{p.serviceTypes.map((s) => labelOf(SERVICE_TYPE_LABELS, s)).join(', ') || '—'}</span>
      ),
    },
    { key: 'price', header: s$.col.price, numeric: true, cell: (p) => <MoneyText value={p.price} /> },
    {
      key: 'status',
      header: m.common.status,
      cell: (p) => (
        <Badge variant={SHIFT_STATUS_BADGE[p.status]} dot={p.status === 'active'}>
          {SHIFT_STATUS_LABELS[p.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{m.common.actions}</span>,
      align: 'right',
      cell: (p) =>
        p.status !== 'cancelled' ? (
          <Button size="sm" variant="danger-ghost" onClick={() => openCancel(p)}>
            {m.common.cancel}
          </Button>
        ) : null,
    },
  ];

  const estimate = target ? estimateShiftRefund(target) : 0;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={s$.title}
        description={s$.description}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={s$.title}
          value={<span className="num">{formatNumber(data?.totals.count ?? 0)}</span>}
          hint={s$.withCancelled}
          isLoading={statsLoading}
        />
        <StatCard
          label={s$.revenue}
          value={<MoneyText value={data?.totals.revenue ?? 0} />}
          hint={s$.withoutCancelled}
          isLoading={statsLoading}
        />
        <StatCard
          label={s$.activeNow}
          value={<span className="num">{formatNumber(data?.totals.activeNow ?? 0)}</span>}
          hint={s$.wholePeriod}
          isLoading={statsLoading}
        />
        <StatCard
          label={s$.cancelledStat}
          value={<span className="num">{formatNumber(data?.totals.cancelled ?? 0)}</span>}
          isLoading={statsLoading}
        />
      </div>

      <DataTable
        ariaLabel={s$.title}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(p) => p.id}
        loading={res.loading}
        error={res.error}
        onRetry={res.reload}
        toolbar={<DateRangeFilter value={range} onChange={changeRange} />}
        empty={{
          variant: 'first-use',
          icon: <Timer aria-hidden />,
          title: s$.emptyTitle,
          description: (
            <>
              {s$.emptyBefore}{' '}
              <Link href="/dashboard/finance-settings" className="text-primary-text hover:underline">
                {s$.emptyLink}
              </Link>
              {s$.emptyAfter}
            </>
          ),
        }}
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
        maxHeightClassName="max-h-[calc(100vh-360px)]"
      />

      <ConfirmDialog
        isOpen={!!target}
        onClose={() => setTarget(null)}
        onConfirm={confirmCancel}
        isPending={cancelling}
        tone="danger"
        title={s$.cancelTitle}
        confirmLabel={refund && estimate > 0 ? s$.cancelAndRefund(formatMoney(estimate)) : m.common.cancel}
        confirmDisabled={!reason.trim()}
        description={
          target
            ? s$.cancelDesc(target.driverName?.trim() || formatPhone(target.driverPhone), formatMoney(target.price))
            : undefined
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-ds-sm border border-line bg-surface-2 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{s$.refundRemaining}</p>
              <p className="mt-0.5 text-xs text-muted">
                {s$.approx} <span className="num">{formatMoney(estimate)}</span> {s$.approxAfter}
              </p>
            </div>
            <Switch checked={refund} onCheckedChange={setRefund} aria-label={s$.refundAria} />
          </div>
          <Textarea
            label={s$.reasonLabel}
            placeholder={s$.reasonPh}
            value={reason}
            maxLength={500}
            rows={3}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
