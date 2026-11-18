'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  FilterBar,
  MoneyText,
  PageHeader,
  SegmentedControl,
  type DataTableColumn,
  type FilterChipData,
  type SortState,
} from '@/components/ui';
import { promoCodesApi, PromoCode } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatDateShort, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { serviceTypesLabel } from '@/lib/promo-service-types';
import { CreatePromoCodeModal } from '@/components/promo/CreatePromoCodeModal';
import { ServiceTypesCell } from '@/components/promo/ServiceTypePicker';
import { t } from '@/locales';

type StatusFilter = 'all' | 'active' | 'inactive';

function statusLabels(): Record<Exclude<StatusFilter, 'all'>, string> {
  const p = t().promo.page;
  return { active: p.active, inactive: p.inactive };
}

function statusItems(): { value: StatusFilter; label: string }[] {
  const p = t().promo.page;
  return [
    { value: 'all', label: p.all },
    { value: 'active', label: p.active },
    { value: 'inactive', label: p.inactive },
  ];
}

function discountText(promo: PromoCode): string {
  return promo.discountPercent != null ? `${promo.discountPercent}%` : formatMoney(promo.discountFixed ?? 0);
}

export default function PromoCodesPage() {
  const m = t();
  const p0 = m.promo.page;
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortState | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<PromoCode | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchPromoCodes = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await promoCodesApi.getAll();
      setPromoCodes(res.data.data);
      setError(null);
    } catch {
      // Oxirgi muvaffaqiyatli qatorlar ekranda qoladi; banner + retry chiqadi.
      setError(p0.loadError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPromoCodes();
  }, [fetchPromoCodes]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = promoCodes;
    if (q) rows = rows.filter((p) => p.code.toLowerCase().includes(q));
    if (statusFilter !== 'all') {
      rows = rows.filter((p) => (statusFilter === 'active' ? p.isActive : !p.isActive));
    }
    if (sort) {
      const dir = sort.direction === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        switch (sort.key) {
          case 'code':
            return a.code.localeCompare(b.code) * dir;
          case 'usedCount':
            return (a.usedCount - b.usedCount) * dir;
          case 'expiresAt':
            return (a.expiresAt ?? '').localeCompare(b.expiresAt ?? '') * dir;
          default:
            return 0;
        }
      });
    }
    return rows;
  }, [promoCodes, search, statusFilter, sort]);

  // Mijoz tomonidagi sahifalash — API butun ro'yxatni bir marta qaytaradi.
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pagination.limit));
  useEffect(() => {
    pagination.setTotal(total, totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, totalPages]);
  const safePage = Math.min(pagination.page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * pagination.limit, safePage * pagination.limit);

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
    pagination.reset();
  };

  const chips: FilterChipData[] = [];
  if (search.trim()) {
    chips.push({
      key: 'search',
      label: p0.chipSearch(search.trim()),
      onRemove: () => {
        setSearch('');
        pagination.reset();
      },
    });
  }
  if (statusFilter !== 'all') {
    chips.push({
      key: 'status',
      label: p0.chipStatus(statusLabels()[statusFilter]),
      onRemove: () => {
        setStatusFilter('all');
        pagination.reset();
      },
    });
  }
  const hasActiveFilters = chips.length > 0;

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await promoCodesApi.deactivate(deactivateTarget.id);
      setPromoCodes((prev) => prev.map((p) => (p.id === deactivateTarget.id ? { ...p, isActive: false } : p)));
      toast({
        title: p0.deactivated(deactivateTarget.code),
        description: p0.deactivatedDesc,
        variant: 'success',
      });
      setDeactivateTarget(null);
    } catch {
      toast({ title: m.common.error, description: p0.deactivateFailed, variant: 'error' });
    } finally {
      setDeactivating(false);
    }
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) return;
    downloadCsv<PromoCode>(
      p0.csvFile(new Date().toISOString().slice(0, 10)),
      [
        { header: p0.colCode, value: (p) => p.code },
        { header: p0.colDiscount, value: (p) => discountText(p) },
        { header: p0.colUsed, value: (p) => p.usedCount },
        { header: p0.colLimit, value: (p) => p.maxUses ?? '' },
        { header: p0.colMinAmount, value: (p) => p.minOrderAmount },
        { header: p0.colExpires, value: (p) => (p.expiresAt ? formatDateShort(p.expiresAt) : '') },
        { header: p0.colServices, value: (p) => serviceTypesLabel(p.serviceTypes) },
        { header: p0.colStatus, value: (p) => (p.isActive ? p0.active : p0.inactive) },
        { header: p0.colCreated, value: (p) => formatDateTime(p.createdAt, { withYear: true }) },
      ],
      filteredRows
    );
    toast({ title: p0.csvDone, description: p0.csvRows(filteredRows.length), variant: 'success' });
  };

  const columns: DataTableColumn<PromoCode>[] = [
    {
      key: 'code',
      header: p0.colCode,
      sortable: true,
      cell: (p) => <span className="font-mono text-[13px] font-medium text-ink whitespace-nowrap">{p.code}</span>,
    },
    {
      key: 'discount',
      header: p0.colDiscount,
      numeric: true,
      cell: (p) =>
        p.discountPercent != null ? `${p.discountPercent}%` : <MoneyText value={p.discountFixed ?? 0} />,
    },
    {
      key: 'usedCount',
      header: p0.colUsed,
      numeric: true,
      sortable: true,
      cell: (p) => (
        <>
          {formatNumber(p.usedCount)}
          {p.maxUses != null && <span className="text-muted"> / {formatNumber(p.maxUses)}</span>}
        </>
      ),
    },
    {
      key: 'services',
      header: p0.colServices,
      hideBelow: 'lg',
      cell: (p) => <ServiceTypesCell value={p.serviceTypes} />,
    },
    {
      key: 'minOrderAmount',
      header: p0.colMinAmount,
      numeric: true,
      hideBelow: 'md',
      cell: (p) => <MoneyText value={p.minOrderAmount} className="text-muted" />,
    },
    {
      key: 'expiresAt',
      header: p0.colExpires,
      sortable: true,
      className: 'num whitespace-nowrap text-muted',
      cell: (p) => (p.expiresAt ? formatDateShort(p.expiresAt) : '—'),
    },
    {
      key: 'status',
      header: p0.colStatus,
      cell: (p) => (
        <Badge variant={p.isActive ? 'success' : 'neutral'} dot>
          {p.isActive ? p0.active : p0.inactive}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{p0.colActions}</span>,
      align: 'right',
      cell: (p) =>
        p.isActive ? (
          <Button variant="danger-ghost" size="sm" onClick={() => setDeactivateTarget(p)}>
            {p0.deactivate}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={p0.title}
        description={p0.total(formatNumber(promoCodes.length))}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
              leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              {p0.exportCsv}
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setCreating(true)}>
              {p0.newCode}
            </Button>
          </>
        }
      />

      <DataTable
        ariaLabel={p0.title}
        columns={columns}
        rows={pagedRows}
        rowKey={(p) => p.id}
        loading={isLoading}
        error={error}
        onRetry={fetchPromoCodes}
        sort={sort}
        onSortChange={setSort}
        maxHeightClassName="max-h-[65vh]"
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              pagination.reset();
            }}
            searchPlaceholder={p0.searchPlaceholder}
            searchAriaLabel={p0.searchAria}
            searchClassName="w-full sm:w-64"
            chips={chips}
            onClearAll={clearAllFilters}
          >
            <SegmentedControl
              ariaLabel={p0.statusFilter}
              items={statusItems()}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                pagination.reset();
              }}
            />
          </FilterBar>
        }
        isFiltered={hasActiveFilters}
        onClearFilters={clearAllFilters}
        emptyFiltered={{ title: p0.noMatchTitle, description: p0.noMatchDesc }}
        empty={{
          variant: 'first-use',
          title: p0.emptyTitle,
          description: p0.emptyDesc,
          action: (
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setCreating(true)}>
              {p0.newCode}
            </Button>
          ),
        }}
        pagination={{
          page: safePage,
          limit: pagination.limit,
          total,
          totalPages,
          onPageChange: pagination.goToPage,
          onLimitChange: pagination.setLimit,
        }}
      />

      <CreatePromoCodeModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onCreated={async (code) => {
          setCreating(false);
          toast({ title: p0.created(code), description: p0.createdDesc, variant: 'success' });
          await fetchPromoCodes();
        }}
      />

      {/* Faolsizlantirish QAYTARIB BO'LMAYDI — API'da qayta yoqish yo'q,
          shuning uchun bu inline toggle emas, tasdiqlash oynasi. */}
      <ConfirmDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        isPending={deactivating}
        title={p0.deactivateTitle}
        confirmLabel={p0.deactivate}
        description={
          <>
            <strong className="font-mono text-ink">{deactivateTarget?.code}</strong> (
            {deactivateTarget ? discountText(deactivateTarget) : ''}
            {p0.deactivateBody}
          </>
        }
      />
    </div>
  );
}

