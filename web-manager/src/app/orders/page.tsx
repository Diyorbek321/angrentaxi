'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw } from 'lucide-react';
import { getOrders, PaginatedResponse, Order } from '@/lib/api';
import {
  OrderStatus,
  ORDER_STATUS,
  orderStatusLabels,
  paymentMethodLabels,
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
import { t } from '@/locales';

function statusOptions() {
  const labels = orderStatusLabels();
  return [
    { value: '', label: t().orders.list.allStatuses },
    ...Object.values(ORDER_STATUS).map((status) => ({
      value: status,
      label: labels[status],
    })),
  ];
}

type DatePreset = 'all' | 'today' | '7d' | '30d';

function datePresets(): readonly { value: DatePreset; label: string }[] {
  const m = t().orders.list;
  return [
    { value: 'all', label: t().common.all },
    { value: 'today', label: m.today },
    { value: '7d', label: m.days7 },
    { value: '30d', label: m.days30 },
  ];
}

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
  const c = t().orders.csv;
  const header = [
    'ID',
    c.customer,
    c.phone,
    c.pickup,
    c.dropoff,
    c.status,
    c.driver,
    c.car,
    c.payment,
    c.price,
    c.created,
  ];
  downloadCsv(
    c.fileName,
    header,
    orders.map((o) => [
      shortId(o.id),
      o.passenger?.name ?? '',
      formatPhone(o.passenger?.phone),
      o.pickupAddress ?? '',
      o.dropoffAddress ?? '',
      orderStatusLabels()[o.status],
      o.driver?.name ?? '',
      o.driver?.carNumber ?? '',
      paymentMethodLabels()[o.paymentMethod],
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
  const m = t();
  const ml = m.orders.list;
  const DATE_PRESETS = datePresets();

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
      setError(t().orders.list.loadFailed);
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
      title: ml.exported(rows.length),
      description: ml.exportedHint,
      variant: 'success',
    });
  };

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (searchQuery) {
      chips.push({
        key: 'q',
        label: ml.chipSearch(searchQuery),
        onRemove: () => setSearchQuery(''),
      });
    }
    if (statusFilter) {
      chips.push({
        key: 'status',
        label: ml.chipStatus(orderStatusLabels()[statusFilter as OrderStatus]),
        onRemove: () => setStatusFilter(''),
      });
    }
    if (datePreset !== 'all') {
      chips.push({
        key: 'date',
        label: ml.chipDate(DATE_PRESETS.find((p) => p.value === datePreset)?.label ?? ''),
        onRemove: () => setDatePreset('all'),
      });
    }
    return chips;
  }, [searchQuery, statusFilter, datePreset]);

  return (
    <PageBody>
      <PageHeader
        title={ml.title}
        description={data ? ml.total(formatNumber(data.total)) : m.common.loading}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={!data || data.data.length === 0}
              leftIcon={<Download size={13} aria-hidden />}
              title={ml.exportTitle}
            >
              {ml.export}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchOrders}
              isLoading={isLoading && data != null}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              {m.common.refresh}
            </Button>
          </>
        }
      />

      <FilterBar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={ml.searchPlaceholder}
        chips={activeChips}
        onClearAll={clearFilters}
        className="mb-3"
      >
        <Select
          options={statusOptions()}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          wrapperClassName="w-48"
          aria-label={ml.statusFilter}
        />
        <SegmentedControl
          items={DATE_PRESETS}
          value={datePreset}
          onChange={setDatePreset}
          ariaLabel={ml.dateRange}
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
