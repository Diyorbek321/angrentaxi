'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ClipboardList, Download, RefreshCw, Search } from 'lucide-react';
import { getOrders, PaginatedResponse, Order } from '@/lib/api';
import {
  OrderStatus,
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/constants';
import { ORDERS_PAGE_SIZES, OrdersTable } from '@/components/orders/OrdersTable';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatNumber, formatPhone, formatTime, shortId } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';

const statusOptions = [
  { value: '', label: 'Barcha statuslar' },
  ...Object.values(ORDER_STATUS).map((status) => ({
    value: status,
    label: ORDER_STATUS_LABELS[status],
  })),
];

type DatePreset = 'all' | 'today' | '7d' | '30d';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'Hammasi' },
  { value: 'today', label: 'Bugun' },
  { value: '7d', label: '7 kun' },
  { value: '30d', label: '30 kun' },
];

function presetToDateFrom(preset: DatePreset): string | undefined {
  if (preset === 'all') return undefined;
  const from = new Date();
  if (preset === 'today') {
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(from.getDate() - (preset === '7d' ? 7 : 30));
  }
  return from.toISOString();
}

/**
 * CSV from the rows already on screen — a pure client-side blob, no extra
 * endpoint. The spreadsheet is the operator's universal escape hatch.
 */
function exportOrdersCsv(orders: Order[]): void {
  const header = [
    'ID',
    'Mijoz',
    'Telefon',
    'Olib ketish',
    'Tashlab ketish',
    'Status',
    'Haydovchi',
    'Mashina',
    'Toʻlov',
    'Narx (soʻm)',
    'Yaratildi',
  ];
  downloadCsv(
    'buyurtmalar',
    header,
    orders.map((o) => [
      shortId(o.id),
      o.passenger?.name ?? '',
      formatPhone(o.passenger?.phone),
      o.pickupAddress ?? '',
      o.dropoffAddress ?? '',
      ORDER_STATUS_LABELS[o.status],
      o.driver?.name ?? '',
      o.driver?.carNumber ?? '',
      PAYMENT_METHOD_LABELS[o.paymentMethod],
      o.finalPrice ?? o.estimatedPrice ?? '',
      new Date(o.createdAt).toLocaleString('uz-UZ'),
    ])
  );
}

function OrdersPageContent() {
  // The header search box routes here with ?q=… — pick it up as the initial
  // query so the search feels continuous across screens.
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const { toast } = useToast();

  const [data, setData] = useState<PaginatedResponse<Order> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ORDERS_PAGE_SIZES[0]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);

  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getOrders({
        page: currentPage,
        limit: pageSize,
        status: statusFilter ? (statusFilter as OrderStatus) : undefined,
        search: debouncedSearch || undefined,
        dateFrom: presetToDateFrom(datePreset),
      });
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      // The last good rows stay on screen — a table that silently blanks on
      // a failed request is lying; the banner below names the failure.
      setError('Buyurtmalarni yangilab boʻlmadi.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, statusFilter, debouncedSearch, datePreset]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset to page 1 when any filter or the page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearch, datePreset, pageSize]);

  const hasFilters = Boolean(statusFilter || searchQuery || datePreset !== 'all');
  const isTodayOnly = datePreset === 'today' && !statusFilter && !searchQuery;

  const clearFilters = () => {
    setStatusFilter('');
    setSearchQuery('');
    setDatePreset('all');
  };

  const handleExport = () => {
    const rows = data?.data ?? [];
    if (rows.length === 0) return;
    exportOrdersCsv(rows);
    toast({
      title: `${rows.length} ta buyurtma CSV faylga eksport qilindi`,
      description: 'Joriy sahifadagi yozuvlar — filtrlar hisobga olingan.',
      variant: 'success',
    });
  };

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (searchQuery) {
      chips.push({
        key: 'q',
        label: `Qidiruv: "${searchQuery}"`,
        onRemove: () => setSearchQuery(''),
      });
    }
    if (statusFilter) {
      chips.push({
        key: 'status',
        label: `Status: ${ORDER_STATUS_LABELS[statusFilter as OrderStatus]}`,
        onRemove: () => setStatusFilter(''),
      });
    }
    if (datePreset !== 'all') {
      chips.push({
        key: 'date',
        label: `Sana: ${DATE_PRESETS.find((p) => p.value === datePreset)?.label}`,
        onRemove: () => setDatePreset('all'),
      });
    }
    return chips;
  }, [searchQuery, statusFilter, datePreset]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-5 pt-4 shrink-0">
        <PageHeader
          title="Buyurtmalar"
          icon={<ClipboardList size={17} />}
          description={
            data ? `Jami ${formatNumber(data.total)} ta buyurtma` : 'Yuklanmoqda…'
          }
          className="mb-4"
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={!data || data.data.length === 0}
                leftIcon={<Download size={13} />}
                title="Joriy sahifadagi yozuvlarni CSV sifatida yuklab olish"
              >
                CSV eksport
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchOrders}
                leftIcon={<RefreshCw size={13} />}
              >
                Yangilash
              </Button>
            </>
          }
        />

        <div className="flex items-center gap-3 flex-wrap pb-3">
          <Input
            placeholder="Mijoz ismi yoki telefon boʻyicha"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftElement={<Search size={14} />}
            className="w-64"
            aria-label="Buyurtmalarni qidirish"
          />
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-48"
            aria-label="Status boʻyicha filtr"
          />
          {/* Date-range presets — segmented, one active at a time. */}
          <div
            role="group"
            aria-label="Sana oraligʻi"
            className="inline-flex items-center rounded-ds-sm border border-line bg-surface-2/60 p-0.5"
          >
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-pressed={datePreset === preset.value}
                onClick={() => setDatePreset(preset.value)}
                className={`h-8 px-2.5 rounded-ds-xs text-xs font-medium transition-colors ${
                  datePreset === preset.value
                    ? 'bg-surface text-ink shadow-card border border-line'
                    : 'text-muted hover:text-ink border border-transparent'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Applied filters as removable chips + one Clear all. */}
        {activeChips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pb-3">
            {activeChips.map((chip) => (
              <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
            ))}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Hammasini tozalash
            </Button>
          </div>
        )}

        {/* A failed refresh names itself and keeps the last good rows below. */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-ds-xs border border-danger/40 bg-danger-tint px-3 py-2 mb-3"
          >
            <AlertTriangle size={14} className="text-danger shrink-0" />
            <p className="text-xs text-danger-deep dark:text-danger-light flex-1">
              {error}
              {data && (
                <span className="text-muted">
                  {' '}
                  Quyida oxirgi muvaffaqiyatli yuklangan maʼlumot koʻrsatilmoqda
                  {` (${formatTime(Date.now())} dan oldingi holat)`}.
                </span>
              )}
            </p>
            <Button variant="secondary" size="sm" onClick={fetchOrders}>
              Qayta urinish
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 px-5 pb-5">
        {error && !data ? (
          <EmptyState
            icon={<AlertTriangle size={22} />}
            title="Buyurtmalarni yuklab boʻlmadi"
            description="Tarmoq yoki server xatosi. Qayta urinib koʻring."
            action={
              <Button variant="secondary" size="sm" onClick={fetchOrders}>
                Qayta urinish
              </Button>
            }
          />
        ) : (
          <OrdersTable
            data={
              data ?? {
                data: [],
                total: 0,
                page: 1,
                limit: pageSize,
                totalPages: 0,
              }
            }
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            isLoading={isLoading}
            hasFilters={hasFilters && !isTodayOnly}
            onClearFilters={clearFilters}
            isTodayView={isTodayOnly}
          />
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  // useSearchParams needs a Suspense boundary for Next's prerender pass.
  return (
    <Suspense
      fallback={
        <div className="p-5">
          <SkeletonTable rows={8} cols={7} />
        </div>
      }
    >
      <OrdersPageContent />
    </Suspense>
  );
}
