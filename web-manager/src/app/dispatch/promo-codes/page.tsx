'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Download, Plus, RefreshCw, Tag } from 'lucide-react';
import { getPromoCodes, createPromoCode, PromoCode } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { FilterBar } from '@/components/ui/FilterBar';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageBody } from '@/components/ui/PageBody';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatDate, formatDateShort, formatNumber } from '@/lib/format';
import { serviceTypesLabel, serviceTypesPayload, type PromoServiceType } from '@/lib/promo-service-types';
import { ServiceTypePicker, ServiceTypesCell } from '@/components/promo/ServiceTypePicker';
import { t } from '@/locales';

const optionalNumber = (label: string, max?: number) =>
  z
    .string()
    .optional()
    .refine(
      (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0 && (max == null || Number(v) <= max)),
      { message: label }
    );

// Built at call time so messages follow the active language.
function buildSchema() {
  const v = t().ops.promo.validation;
  return z
    .object({
      code: z
        .string()
        .min(3, v.codeMin)
        .max(50, v.codeMax)
        .regex(/^[A-Za-z0-9_-]+$/, v.codeChars),
      discountPercent: optionalNumber(v.percent, 100),
      discountFixed: optionalNumber(v.positiveAmount),
      maxUses: optionalNumber(v.positiveNumber),
      minOrderAmount: optionalNumber(v.positiveAmount),
      expiresAt: z.string().optional(),
    })
    .refine((data) => data.discountPercent || data.discountFixed, {
      message: v.discountRequired,
      path: ['discountPercent'],
    });
}

type FormData = z.infer<ReturnType<typeof buildSchema>>;

type StatusFilter = 'all' | 'active' | 'inactive' | 'expiring';

function statusLabels(): Record<StatusFilter, string> {
  const s = t().ops.promo.status;
  return { all: t().common.all, active: s.active, expiring: s.expiring, inactive: s.inactive };
}

function statusTabs(): readonly { value: StatusFilter; label: string }[] {
  const labels = statusLabels();
  return (['all', 'active', 'expiring', 'inactive'] as const).map((value) => ({ value, label: labels[value] }));
}

function expiresWithin7Days(promo: PromoCode): boolean {
  if (!promo.expiresAt) return false;
  const days = (new Date(promo.expiresAt).getTime() - Date.now()) / 86400000;
  return days > 0 && days <= 7;
}

export default function PromoCodesPage() {
  const m = t();
  const pm = m.ops.promo;
  const { toast } = useToast();
  const schema = useMemo(() => buildSchema(), []);
  const STATUS_LABEL = statusLabels();
  const STATUS_TABS = statusTabs();

  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [serviceTypes, setServiceTypes] = useState<PromoServiceType[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const fetchPromoCodes = async () => {
    setIsLoading(true);
    try {
      const data = await getPromoCodes();
      setPromoCodes(data);
      setLoadError(null);
    } catch {
      setLoadError(t().ops.promo.loadFailed);
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    const code = data.code.toUpperCase();
    try {
      await createPromoCode({
        code,
        discountPercent: data.discountPercent ? Number(data.discountPercent) : undefined,
        discountFixed: data.discountFixed ? Number(data.discountFixed) : undefined,
        maxUses: data.maxUses ? Number(data.maxUses) : undefined,
        minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : undefined,
        expiresAt: data.expiresAt || undefined,
        ...serviceTypesPayload(serviceTypes),
      });
      reset();
      setServiceTypes([]);
      setIsModalOpen(false);
      toast({
        title: pm.created(code),
        description: pm.createdDescription,
        variant: 'success',
      });
      await fetchPromoCodes();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        pm.createFailed;
      setSubmitError(message);
    }
  };

  // Newest first, so a just-created code is at the top where it is looked for.
  const rows = useMemo(() => {
    const needle = searchInput.trim().toLowerCase();
    return [...promoCodes]
      .filter((p) => {
        if (statusFilter === 'active') return p.isActive;
        if (statusFilter === 'inactive') return !p.isActive;
        if (statusFilter === 'expiring') return p.isActive && expiresWithin7Days(p);
        return true;
      })
      .filter((p) => (needle === '' ? true : p.code.toLowerCase().includes(needle)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [promoCodes, searchInput, statusFilter]);

  const hasFilters = Boolean(searchInput || statusFilter !== 'all');

  const clearFilters = () => {
    setSearchInput('');
    setStatusFilter('all');
  };

  const handleExport = () => {
    if (rows.length === 0) return;
    downloadCsv(
      'promo-kodlar',
      [
        pm.csv.code,
        pm.csv.discountPercent,
        pm.csv.discountFixed,
        pm.csv.used,
        pm.csv.limit,
        pm.csv.minAmount,
        pm.csv.expires,
        pm.csv.services,
        pm.csv.status,
      ],
      rows.map((p) => [
        p.code,
        p.discountPercent ?? '',
        p.discountFixed ?? '',
        p.usedCount,
        p.maxUses ?? '',
        p.minOrderAmount,
        p.expiresAt ? formatDateShort(p.expiresAt) : '',
        serviceTypesLabel(p.serviceTypes),
        p.isActive ? pm.status.active : pm.status.inactive,
      ])
    );
    toast({
      title: pm.exported(rows.length),
      variant: 'success',
    });
  };

  const showSkeleton = isLoading && !hasLoadedOnce;

  const columns: DataTableColumn<PromoCode>[] = [
    {
      key: 'code',
      header: pm.columns.code,
      cell: (p) => <span className="font-mono font-semibold text-ink">{p.code}</span>,
    },
    {
      key: 'discount',
      header: pm.columns.discount,
      numeric: true,
      cell: (p) =>
        p.discountPercent != null ? (
          <span className="text-ink">{p.discountPercent}%</span>
        ) : (
          <MoneyText value={p.discountFixed} className="text-ink" />
        ),
    },
    {
      key: 'used',
      header: pm.columns.used,
      numeric: true,
      cell: (p) => (
        <span className="text-muted">
          {formatNumber(p.usedCount)}
          {p.maxUses != null ? ` / ${formatNumber(p.maxUses)}` : ''}
        </span>
      ),
    },
    {
      key: 'services',
      header: pm.columns.services,
      hideBelow: 'lg',
      cell: (p) => <ServiceTypesCell value={p.serviceTypes} />,
    },
    {
      key: 'min',
      header: pm.columns.minAmount,
      numeric: true,
      hideBelow: 'md',
      cell: (p) => <MoneyText value={p.minOrderAmount} className="text-muted" />,
    },
    {
      key: 'expires',
      header: pm.columns.expires,
      className: 'num text-muted whitespace-nowrap',
      cell: (p) => (
        <>
          {p.expiresAt ? formatDate(p.expiresAt) : '—'}
          {expiresWithin7Days(p) && <span className="ml-2 text-info-dark dark:text-info-light">{pm.soon}</span>}
        </>
      ),
    },
    {
      key: 'status',
      header: pm.columns.status,
      cell: (p) => (
        <Badge variant={p.isActive ? 'success' : 'neutral'} size="sm" dot>
          {p.isActive ? pm.status.active : pm.status.inactive}
        </Badge>
      ),
    },
  ];

  const chips = [
    ...(searchInput
      ? [{ key: 'q', label: pm.chipSearch(searchInput), onRemove: () => setSearchInput('') }]
      : []),
    ...(statusFilter !== 'all'
      ? [{ key: 'status', label: pm.chipStatus(STATUS_LABEL[statusFilter]), onRemove: () => setStatusFilter('all') }]
      : []),
  ];

  return (
    <PageBody className="max-w-5xl">
      <PageHeader
        title={pm.title}
        description={pm.description}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={rows.length === 0}
              leftIcon={<Download size={13} aria-hidden />}
            >
              {pm.exportCsv}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchPromoCodes}
              isLoading={isLoading && hasLoadedOnce}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              {m.common.refresh}
            </Button>
            <Button leftIcon={<Plus size={14} aria-hidden />} onClick={() => setIsModalOpen(true)} size="sm">
              {pm.newCode}
            </Button>
          </>
        }
      />

      <FilterBar
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={pm.searchPlaceholder}
        chips={chips}
        onClearAll={clearFilters}
        className="mb-3"
      >
        <SegmentedControl
          items={STATUS_TABS}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel={pm.statusFilterAria}
        />
      </FilterBar>

      <DataTable
        ariaLabel={pm.title}
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        loading={showSkeleton}
        error={loadError}
        onRetry={fetchPromoCodes}
        maxHeightClassName="max-h-[calc(100vh-16rem)]"
        footer={
          hasLoadedOnce && rows.length > 0 ? (
            <span className="num">
              {hasFilters
                ? pm.footerFiltered(formatNumber(rows.length), formatNumber(promoCodes.length))
                : pm.footer(formatNumber(rows.length))}
            </span>
          ) : undefined
        }
        isFiltered={hasFilters}
        onClearFilters={clearFilters}
        emptyFiltered={{
          title: pm.emptyFilteredTitle,
          description: pm.emptyFilteredDescription,
        }}
        empty={{
          variant: 'first-use',
          icon: <Tag aria-hidden />,
          title: pm.emptyTitle,
          description: pm.emptyDescription,
          action: (
            <Button size="sm" leftIcon={<Plus size={14} aria-hidden />} onClick={() => setIsModalOpen(true)}>
              {pm.newCode}
            </Button>
          ),
        }}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={pm.newCode}
        subtitle={pm.modalSubtitle}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2"
            >
              <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" aria-hidden />
              <p className="text-[13px] text-danger-dark dark:text-danger-light">{submitError}</p>
            </div>
          )}

          <Input
            label={pm.fields.code}
            placeholder="ANGREN10"
            mono
            hint={pm.fields.codeHint}
            {...register('code')}
            error={errors.code?.message}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={pm.fields.discountPercent}
              type="number"
              placeholder="10"
              {...register('discountPercent')}
              error={errors.discountPercent?.message}
            />
            <Input
              label={pm.fields.discountFixed}
              type="number"
              placeholder="5000"
              {...register('discountFixed')}
              error={errors.discountFixed?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={pm.fields.maxUses}
              type="number"
              placeholder="100"
              {...register('maxUses')}
              error={errors.maxUses?.message}
            />
            <Input
              label={pm.fields.minOrderAmount}
              type="number"
              placeholder="0"
              {...register('minOrderAmount')}
              error={errors.minOrderAmount?.message}
            />
          </div>
          <ServiceTypePicker value={serviceTypes} onChange={setServiceTypes} disabled={isSubmitting} />
          <Input
            label={pm.fields.expiresAt}
            type="date"
            hint={pm.fields.expiresHint}
            {...register('expiresAt')}
            error={errors.expiresAt?.message}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              {m.common.cancel}
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {pm.create}
            </Button>
          </div>
        </form>
      </Modal>
    </PageBody>
  );
}
