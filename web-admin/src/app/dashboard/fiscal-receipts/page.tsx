'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, RotateCw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFilter, EMPTY_DATE_RANGE, type DateRangeValue } from '@/components/ui/DateRangeFilter';
import { Input } from '@/components/ui/Input';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Notice } from '@/components/settings/Notice';
import { usePagination } from '@/hooks/usePagination';
import {
  fiscalReceiptsApi,
  type FiscalPrincipalType,
  type FiscalReceipt,
  type FiscalReceiptStatus,
} from '@/lib/compliance-api';
import { apiErrorMessage, dateRangeToIso, isFiscalProviderLikelyMissing, isUuid } from '@/lib/compliance';
import {
  FISCAL_STATUS_BADGE,
  fiscalStatusLabels,
  labelOf,
  paymentMethodLabels,
  principalTypeLabels,
  serviceTypeLabels,
} from '@/lib/compliance-labels';
import { formatDateTime, formatNumber, shortId } from '@/lib/format';
import { t } from '@/locales';

type StatusFilter = FiscalReceiptStatus | 'all';
const STATUSES: FiscalReceiptStatus[] = ['pending', 'failed', 'sent', 'skipped'];
const EMPTY_COUNTS: Record<FiscalReceiptStatus, number> = { pending: 0, sent: 0, failed: 0, skipped: 0 };


const canRetry = (r: FiscalReceipt) => r.status === 'failed' || r.status === 'pending';

/** Fiskal cheklar navbati (komissioner modeli) — LEGAL-COMPLIANCE §3. */
export default function FiscalReceiptsPage() {
  const m = t();
  const f$ = m.compliance.fiscal;
  const SERVICE_TYPE_LABELS = serviceTypeLabels();
  const PRINCIPAL_TYPE_LABELS = principalTypeLabels();
  const FISCAL_STATUS_LABELS = fiscalStatusLabels();
  const PAYMENT_METHOD_LABELS = paymentMethodLabels();
  const SERVICE_OPTIONS = [
    { value: '', label: f$.allServices },
    ...['taxi', 'cargo', 'parcel', 'food', 'market', 'shift_pass'].map((v) => ({ value: v, label: SERVICE_TYPE_LABELS[v] })),
  ];
  const PRINCIPAL_OPTIONS = [
    { value: '', label: f$.allPrincipals },
    ...(Object.keys(PRINCIPAL_TYPE_LABELS) as FiscalPrincipalType[]).map((v) => ({
      value: v,
      label: PRINCIPAL_TYPE_LABELS[v],
    })),
  ];
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [rows, setRows] = useState<FiscalReceipt[]>([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [serviceType, setServiceType] = useState('');
  const [principalType, setPrincipalType] = useState('');
  const [range, setRange] = useState<DateRangeValue>(EMPTY_DATE_RANGE);
  const [orderId, setOrderId] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  const orderIdValid = orderId.trim() === '' || isUuid(orderId);

  const load = useCallback(async () => {
    if (!orderIdValid) return;
    setIsLoading(true);
    try {
      const res = await fiscalReceiptsApi.list({
        page: pagination.page,
        limit: pagination.limit,
        status: status === 'all' ? undefined : status,
        serviceType: serviceType || undefined,
        principalType: (principalType || undefined) as FiscalPrincipalType | undefined,
        orderId: orderId.trim() || undefined,
        ...dateRangeToIso(range),
      });
      const data = res.data.data;
      setRows(data.items);
      setCounts({ ...EMPTY_COUNTS, ...data.counts });
      pagination.setTotal(data.total, Math.max(1, Math.ceil(data.total / pagination.limit)));
      setError(null);
    } catch {
      setError(f$.loadError);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, status, serviceType, principalType, range, orderId, orderIdValid]);

  useEffect(() => {
    void load();
  }, [load]);

  const withReset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    pagination.reset();
  };

  const clearFilters = () => {
    setStatus('all');
    setServiceType('');
    setPrincipalType('');
    setRange(EMPTY_DATE_RANGE);
    setOrderId('');
    pagination.reset();
  };

  const retryOne = async (r: FiscalReceipt) => {
    setRetryingId(r.id);
    try {
      const res = await fiscalReceiptsApi.retry(r.id);
      const next = res.data.data;
      toast({
        title: next.status === 'sent' ? f$.sent : f$.statusIs(FISCAL_STATUS_LABELS[next.status]),
        description: next.lastError ?? f$.orderRef(shortId(r.orderId)),
        variant: next.status === 'sent' ? 'success' : 'error',
      });
      void load();
    } catch (err) {
      toast({ title: m.common.error, description: apiErrorMessage(err, f$.retryOneError), variant: 'error' });
    } finally {
      setRetryingId(null);
    }
  };

  const retryAll = async () => {
    setRetryingAll(true);
    try {
      const res = await fiscalReceiptsApi.retryPending();
      const s = res.data.data;
      toast({
        title: s.retried === 0 ? f$.nothingToRetry : f$.retried(formatNumber(s.retried)),
        description:
          s.retried === 0
            ? undefined
            : f$.retrySummary(s.sent, s.failed, s.skipped),
        variant: s.failed > 0 ? 'error' : 'success',
      });
      void load();
    } catch (err) {
      toast({ title: m.common.error, description: apiErrorMessage(err, f$.retryAllError), variant: 'error' });
    } finally {
      setRetryingAll(false);
    }
  };

  const retryable = counts.failed + counts.pending;
  const isFiltered =
    status !== 'all' || !!serviceType || !!principalType || range.preset !== null || orderId.trim() !== '';

  const columns: DataTableColumn<FiscalReceipt>[] = [
    {
      key: 'order',
      header: f$.col.order,
      cell: (r) => (
        <div className="leading-tight">
          <span className="font-mono text-xs text-ink">{shortId(r.orderId)}</span>
          <p className="text-xs text-muted">{labelOf(SERVICE_TYPE_LABELS, r.serviceType)}</p>
        </div>
      ),
    },
    {
      key: 'principal',
      header: f$.col.principal,
      cell: (r) => (
        <div className="leading-tight">
          <p className="text-ink">{PRINCIPAL_TYPE_LABELS[r.principalType] ?? r.principalType}</p>
          <p className="font-mono text-xs text-muted">
            {r.principalTin ?? r.principalPinfl ?? <span className="font-sans text-danger-dark dark:text-danger-light">{f$.noTin}</span>}
          </p>
        </div>
      ),
    },
    { key: 'total', header: f$.col.total, numeric: true, cell: (r) => <MoneyText value={r.total} /> },
    {
      key: 'commission',
      header: f$.col.commission,
      numeric: true,
      hideBelow: 'xl',
      cell: (r) => <MoneyText value={r.commissionAmount} className="text-muted" />,
    },
    {
      key: 'payment',
      header: f$.col.payment,
      hideBelow: 'lg',
      cell: (r) => <span className="text-muted">{labelOf(PAYMENT_METHOD_LABELS, r.paymentMethod)}</span>,
    },
    {
      key: 'status',
      header: m.common.status,
      cell: (r) => (
        <div className="min-w-0">
          <Badge variant={FISCAL_STATUS_BADGE[r.status]} dot>
            {FISCAL_STATUS_LABELS[r.status]}
          </Badge>
          {r.lastError && (
            <p className="mt-0.5 max-w-[220px] truncate text-xs text-subtle" title={r.lastError}>
              {r.lastError}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'attempts',
      header: f$.col.attempts,
      numeric: true,
      hideBelow: '2xl',
      cell: (r) => <span className="num">{r.attempts}</span>,
    },
    {
      key: 'createdAt',
      header: m.common.date,
      hideBelow: 'xl',
      cell: (r) => <span className="num whitespace-nowrap text-muted">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">{m.common.actions}</span>,
      align: 'right',
      cell: (r) =>
        canRetry(r) ? (
          <Button size="sm" variant="secondary" isLoading={retryingId === r.id} onClick={() => retryOne(r)}>
            {f$.retry}
          </Button>
        ) : null,
    },
  ];

  const statusItems = [
    { value: 'all' as StatusFilter, label: m.common.allAlt, count: STATUSES.reduce((a, s) => a + counts[s], 0) },
    ...STATUSES.map((s) => ({ value: s as StatusFilter, label: FISCAL_STATUS_LABELS[s], count: counts[s] })),
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={f$.title}
        description={f$.description}
        actions={
          <Button
            variant="secondary"
            onClick={retryAll}
            isLoading={retryingAll}
            disabled={retryable === 0}
            leftIcon={<RotateCw size={14} aria-hidden="true" />}
          >
            {f$.retryAll}{retryable > 0 ? ` (${formatNumber(retryable)})` : ''}
          </Button>
        }
      />

      {isFiscalProviderLikelyMissing(counts) && (
        <Notice tone="info" title={f$.providerMissingTitle} className="mb-4">
          {f$.providerMissingBefore}{' '}
          (<span className="font-mono">FISCAL_PROVIDER=noop</span>). {f$.providerMissingAfter}
        </Notice>
      )}

      <DataTable
        ariaLabel={f$.title}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={isLoading}
        error={error}
        onRetry={load}
        isFiltered={isFiltered}
        onClearFilters={clearFilters}
        empty={{
          variant: 'first-use',
          icon: <FileText aria-hidden />,
          title: f$.emptyTitle,
          description: f$.emptyDesc,
        }}
        maxHeightClassName="max-h-[calc(100vh-320px)]"
        toolbar={
          <div className="flex flex-col gap-3">
            <SegmentedControl
              ariaLabel={m.common.statusFilterAlt}
              items={statusItems}
              value={status}
              onChange={withReset(setStatus)}
            />
            <div className="flex flex-wrap items-start gap-2">
              <Select
                aria-label={f$.serviceTypeAria}
                options={SERVICE_OPTIONS}
                value={serviceType}
                onChange={(e) => withReset(setServiceType)(e.target.value)}
                wrapperClassName="w-44"
              />
              <Select
                aria-label={f$.principalTypeAria}
                options={PRINCIPAL_OPTIONS}
                value={principalType}
                onChange={(e) => withReset(setPrincipalType)(e.target.value)}
                wrapperClassName="w-44"
              />
              <Input
                aria-label={f$.orderIdAria}
                placeholder={f$.orderIdPh}
                mono
                value={orderId}
                error={orderIdValid ? undefined : f$.fullUuid}
                onChange={(e) => withReset(setOrderId)(e.target.value)}
                wrapperClassName="w-72"
              />
              <DateRangeFilter value={range} onChange={withReset(setRange)} />
            </div>
          </div>
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
    </div>
  );
}
