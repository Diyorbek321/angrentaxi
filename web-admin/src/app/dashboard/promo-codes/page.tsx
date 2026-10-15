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

type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_LABELS: Record<Exclude<StatusFilter, 'all'>, string> = {
  active: 'Faol',
  inactive: 'Faol emas',
};

const STATUS_ITEMS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Hammasi' },
  { value: 'active', label: 'Faol' },
  { value: 'inactive', label: 'Faol emas' },
];

function discountText(promo: PromoCode): string {
  return promo.discountPercent != null ? `${promo.discountPercent}%` : formatMoney(promo.discountFixed ?? 0);
}

export default function PromoCodesPage() {
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
      setError("Promo kodlarni yuklab bo'lmadi");
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
      label: `Qidiruv: "${search.trim()}"`,
      onRemove: () => {
        setSearch('');
        pagination.reset();
      },
    });
  }
  if (statusFilter !== 'all') {
    chips.push({
      key: 'status',
      label: `Holat: ${STATUS_LABELS[statusFilter]}`,
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
        title: `«${deactivateTarget.code}» faolsizlantirildi`,
        description: "Bundan buyon yangi buyurtmalarga qo'llanilmaydi.",
        variant: 'success',
      });
      setDeactivateTarget(null);
    } catch {
      toast({ title: 'Xatolik', description: 'Faolsizlantirishda xatolik', variant: 'error' });
    } finally {
      setDeactivating(false);
    }
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) return;
    downloadCsv<PromoCode>(
      `promo-kodlar-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'Kod', value: (p) => p.code },
        { header: 'Chegirma', value: (p) => discountText(p) },
        { header: 'Ishlatilgan', value: (p) => p.usedCount },
        { header: 'Limit', value: (p) => p.maxUses ?? '' },
        { header: 'Min. summa', value: (p) => p.minOrderAmount },
        { header: 'Muddati', value: (p) => (p.expiresAt ? formatDateShort(p.expiresAt) : '') },
        { header: 'Xizmatlar', value: (p) => serviceTypesLabel(p.serviceTypes) },
        { header: 'Holati', value: (p) => (p.isActive ? 'Faol' : 'Faol emas') },
        { header: 'Yaratilgan', value: (p) => formatDateTime(p.createdAt, { withYear: true }) },
      ],
      filteredRows
    );
    toast({ title: 'CSV yuklab olindi', description: `${filteredRows.length} ta qator`, variant: 'success' });
  };

  const columns: DataTableColumn<PromoCode>[] = [
    {
      key: 'code',
      header: 'Kod',
      sortable: true,
      cell: (p) => <span className="font-mono text-[13px] font-medium text-ink whitespace-nowrap">{p.code}</span>,
    },
    {
      key: 'discount',
      header: 'Chegirma',
      numeric: true,
      cell: (p) =>
        p.discountPercent != null ? `${p.discountPercent}%` : <MoneyText value={p.discountFixed ?? 0} />,
    },
    {
      key: 'usedCount',
      header: 'Ishlatilgan',
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
      header: 'Xizmatlar',
      hideBelow: 'lg',
      cell: (p) => <ServiceTypesCell value={p.serviceTypes} />,
    },
    {
      key: 'minOrderAmount',
      header: 'Min. summa',
      numeric: true,
      hideBelow: 'md',
      cell: (p) => <MoneyText value={p.minOrderAmount} className="text-muted" />,
    },
    {
      key: 'expiresAt',
      header: 'Muddati',
      sortable: true,
      className: 'num whitespace-nowrap text-muted',
      cell: (p) => (p.expiresAt ? formatDateShort(p.expiresAt) : '—'),
    },
    {
      key: 'status',
      header: 'Holati',
      cell: (p) => (
        <Badge variant={p.isActive ? 'success' : 'neutral'} dot>
          {p.isActive ? 'Faol' : 'Faol emas'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amallar</span>,
      align: 'right',
      cell: (p) =>
        p.isActive ? (
          <Button variant="danger-ghost" size="sm" onClick={() => setDeactivateTarget(p)}>
            Faolsizlantirish
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Promo kodlar"
        description={`Jami: ${formatNumber(promoCodes.length)} ta`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
              leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              CSV eksport
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setCreating(true)}>
              Yangi promo kod
            </Button>
          </>
        }
      />

      <DataTable
        ariaLabel="Promo kodlar"
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
            searchPlaceholder="Kod bo'yicha qidirish…"
            searchAriaLabel="Promo kodlarni qidirish"
            searchClassName="w-full sm:w-64"
            chips={chips}
            onClearAll={clearAllFilters}
          >
            <SegmentedControl
              ariaLabel="Holat bo'yicha filtr"
              items={STATUS_ITEMS}
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
        emptyFiltered={{ title: 'Hech narsa mos kelmadi', description: "Tanlangan filtrlar bo'yicha promo kod topilmadi." }}
        empty={{
          variant: 'first-use',
          title: "Promo kodlar yo'q",
          description: 'Birinchi chegirma kodini yarating — u darhol amal qila boshlaydi.',
          action: (
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setCreating(true)}>
              Yangi promo kod
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
          toast({ title: `«${code}» promo kodi yaratildi`, description: 'Kod darhol amal qila boshlaydi.', variant: 'success' });
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
        title="Promo kodni faolsizlantirish"
        confirmLabel="Faolsizlantirish"
        description={
          <>
            <strong className="font-mono text-ink">{deactivateTarget?.code}</strong> (
            {deactivateTarget ? discountText(deactivateTarget) : ''}) faolsizlantiriladi va bundan buyon yangi
            buyurtmalarga qo&apos;llanilmaydi. Kodni keyin qayta yoqib bo&apos;lmaydi — kerak bo&apos;lsa yangi kod
            yaratiladi.
          </>
        }
      />
    </div>
  );
}

