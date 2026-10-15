'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw } from 'lucide-react';
import { getOrders, PaginatedResponse, Order } from '@/lib/api';
import {
  OrderStatus,
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/constants';
import { ORDERS_PAGE_SIZES, OrdersTable } from '@/components/orders/OrdersTable';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageBody } from '@/components/ui/PageBody';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatNumber, formatPhone, shortId } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';

const statusOptions = [
  { value: '', label: 'Barcha statuslar' },
  ...Object.values(ORDER_STATUS).map((status) => ({
    value: status,
    label: ORDER_STATUS_LABELS[status],
  })),
];

type DatePreset = 'all' | 'today' | '7d' | '30d';

const DATE_PRESETS: readonly { value: DatePreset; label: string }[] = [
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
      formatDateTime(o.createdAt, { withYear: true }),
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
    <PageBody>
      <PageHeader
        title="Buyurtmalar"
        description={data ? `Jami ${formatNumber(data.total)} ta buyurtma` : 'Yuklanmoqda…'}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={!data || data.data.length === 0}
              leftIcon={<Download size={13} aria-hidden />}
              title="Joriy sahifadagi yozuvlarni CSV sifatida yuklab olish"
            >
              CSV eksport
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchOrders}
              isLoading={isLoading && data != null}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              Yangilash
            </Button>
          </>
        }
      />

      <FilterBar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Mijoz ismi yoki telefon boʻyicha"
        chips={activeChips}
        onClearAll={clearFilters}
        className="mb-3"
      >
        <Select
          options={statusOptions}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          wrapperClassName="w-48"
          aria-label="Status boʻyicha filtr"
        />
        <SegmentedControl
          items={DATE_PRESETS}
          value={datePreset}
          onChange={setDatePreset}
          ariaLabel="Sana oraligʻi"
        />
      </FilterBar>

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
        error={error}
        onRetry={fetchOrders}
        hasFilters={hasFilters && !isTodayOnly}
        onClearFilters={clearFilters}
        isTodayView={isTodayOnly}
      />
    </PageBody>
  );
}

export default function OrdersPage() {
  // useSearchParams needs a Suspense boundary for Next's prerender pass.
  return (
    <Suspense
      fallback={
        <PageBody>
          <SkeletonTable rows={8} cols={7} />
        </PageBody>
      }
    >
      <OrdersPageContent />
    </Suspense>
  );
}
