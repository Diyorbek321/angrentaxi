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
import { labelOf, SERVICE_TYPE_LABELS, SHIFT_STATUS_BADGE, SHIFT_STATUS_LABELS } from '@/lib/compliance-labels';
import { formatDateTime, formatMoney, formatNumber, formatPhone } from '@/lib/format';

const DEFAULT_RANGE: DateRangeValue = { preset: '30d', ...rangeForPreset('30d') };

/** Haydovchi smenalari (kunlik obuna) — LEGAL-COMPLIANCE §8, §15. */
export default function ShiftPassesPage() {
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
    'Smenalarni yuklab boʻlmadi',
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
        title: 'Smena bekor qilindi',
        description: refunded > 0 ? `${formatMoney(refunded)} hamyonga qaytarildi.` : 'Pul qaytarilmadi.',
        variant: 'success',
      });
      setTarget(null);
      void res.reload();
    } catch (err) {
      toast({ title: 'Xatolik', description: apiErrorMessage(err, 'Smenani bekor qilib boʻlmadi'), variant: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  const columns: DataTableColumn<AdminShiftPass>[] = [
    {
      key: 'driver',
      header: 'Haydovchi',
      cell: (p) => (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-medium text-ink">{p.driverName?.trim() || 'Ism kiritilmagan'}</p>
          <p className="num whitespace-nowrap text-xs text-muted">{formatPhone(p.driverPhone)}</p>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Davr',
      cell: (p) => (
        <div className="num whitespace-nowrap text-xs leading-tight">
          <p className="text-ink">{formatDateTime(p.startsAt)}</p>
          <p className="text-muted">→ {formatDateTime(p.endsAt)}</p>
        </div>
      ),
    },
    {
      key: 'services',
      header: 'Xizmatlar',
      hideBelow: 'xl',
      cell: (p) => (
        <span className="text-muted">{p.serviceTypes.map((s) => labelOf(SERVICE_TYPE_LABELS, s)).join(', ') || '—'}</span>
      ),
    },
    { key: 'price', header: 'Narx', numeric: true, cell: (p) => <MoneyText value={p.price} /> },
    {
      key: 'status',
      header: 'Holat',
      cell: (p) => (
        <Badge variant={SHIFT_STATUS_BADGE[p.status]} dot={p.status === 'active'}>
          {SHIFT_STATUS_LABELS[p.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amallar</span>,
      align: 'right',
      cell: (p) =>
        p.status !== 'cancelled' ? (
          <Button size="sm" variant="danger-ghost" onClick={() => openCancel(p)}>
            Bekor qilish
          </Button>
        ) : null,
    },
  ];

  const estimate = target ? estimateShiftRefund(target) : 0;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Smenalar"
        description="Haydovchilar sotib olgan kunlik smenalar (davrda boshlanganlar). Sozlamalar — «Moliya sozlamalari»."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Smenalar"
          value={<span className="num">{formatNumber(data?.totals.count ?? 0)}</span>}
          hint="Bekor qilinganlar bilan"
          isLoading={statsLoading}
        />
        <StatCard
          label="Daromad"
          value={<MoneyText value={data?.totals.revenue ?? 0} />}
          hint="Bekor qilinganlarsiz"
          isLoading={statsLoading}
        />
        <StatCard
          label="Hozir faol"
          value={<span className="num">{formatNumber(data?.totals.activeNow ?? 0)}</span>}
          hint="Butun davr boʻyicha"
          isLoading={statsLoading}
        />
        <StatCard
          label="Bekor qilingan"
          value={<span className="num">{formatNumber(data?.totals.cancelled ?? 0)}</span>}
          isLoading={statsLoading}
        />
      </div>

      <DataTable
        ariaLabel="Smenalar"
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
          title: 'Smenalar yoʻq',
          description: (
            <>
              Bu davrda smena sotib olinmagan. Smena sotuvi{' '}
              <Link href="/dashboard/finance-settings" className="text-primary-text hover:underline">
                Moliya sozlamalari
              </Link>
              da yoqiladi.
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
        title="Smenani bekor qilish"
        confirmLabel={refund && estimate > 0 ? `Bekor qilish va ~${formatMoney(estimate)} qaytarish` : 'Bekor qilish'}
        confirmDisabled={!reason.trim()}
        description={
          target
            ? `${target.driverName?.trim() || formatPhone(target.driverPhone)} · ${formatMoney(target.price)}. Smena darhol tugaydi, haydovchiga push yuboriladi va amallar jurnaliga yoziladi.`
            : undefined
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-ds-sm border border-line bg-surface-2 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Qolgan vaqt uchun pulni qaytarish</p>
              <p className="mt-0.5 text-xs text-muted">
                Taxminan <span className="num">{formatMoney(estimate)}</span> — aniq summa bekor qilingan paytda
                hisoblanadi.
              </p>
            </div>
            <Switch checked={refund} onCheckedChange={setRefund} aria-label="Pulni qaytarish" />
          </div>
          <Textarea
            label="Sabab (majburiy)"
            placeholder="Masalan: texnik nosozlik tufayli"
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
