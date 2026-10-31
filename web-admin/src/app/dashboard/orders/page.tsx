'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { Select } from '@/components/ui/Select';
import type { FilterChip } from '@/components/ui/FilterChips';
import type { SortState } from '@/components/ui/DataTable';
import {
  DateRangeFilter,
  DATE_PRESET_LABELS,
  EMPTY_DATE_RANGE,
  type DateRangeValue,
} from '@/components/ui/DateRangeFilter';
import { OrdersTable, orderPrice } from '@/components/orders/OrdersTable';
import { ordersApi, Order } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { debounce, formatDate } from '@/lib/utils';
import { formatMoney, formatNumber, fullName, shortId } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import {
  ORDER_STATUSES,
  orderStatusLabels,
  paymentMethodLabels,
  type OrderStatus,
  type PaymentMethod,
} from '@/lib/constants';
import { t } from '@/locales';

function statusOptions() {
  return [
    { value: 'all', label: t().orders.list.allStatuses },
    ...Object.values(ORDER_STATUSES).map((value) => ({ value, label: orderStatusLabels()[value] })),
  ];
}

export default function OrdersPage() {
  const m = t().orders.list;
  const mc = t().common;
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>(EMPTY_DATE_RANGE);
  // Tri-state sort (asc → desc → clear = server order, newest first), client-side on the loaded page.
  const [sort, setSort] = useState<SortState | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ordersApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        from: dateRange.from ?? undefined,
        to: dateRange.to ?? undefined,
      });
      const payload = res.data.data;
      setOrders(payload?.orders ?? []);
      const total = payload?.total ?? 0;
      pagination.setTotal(total, Math.ceil(total / pagination.limit));
      setError(null);
    } catch {
      // Last good rows stay on screen; DataTable shows a retry banner above them.
      setError(m.loadError);
      toast({ title: mc.error, description: m.loadError, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, search, statusFilter, dateRange.from, dateRange.to]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const paginationReset = pagination.reset;
  const debouncedSearch = useRef(
    debounce((value: string) => {
      setSearch(value);
      paginationReset();
    }, 400)
  ).current;

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedSearch(value);
  };

  const sortedOrders = useMemo(() => {
    if (!sort) return orders;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...orders].sort((a, b) => {
      switch (sort.key) {
        case 'id':
          return a.id.localeCompare(b.id) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'price':
          return (orderPrice(a) - orderPrice(b)) * dir;
        case 'createdAt':
          return a.createdAt.localeCompare(b.createdAt) * dir;
        default:
          return 0;
      }
    });
  }, [orders, sort]);

  const clearAllFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('all');
    setDateRange(EMPTY_DATE_RANGE);
    pagination.reset();
  };

  const chips: FilterChip[] = [];
  if (search) {
    chips.push({
      key: 'search',
      label: m.chipSearch(search),
      onRemove: () => {
        setSearchInput('');
        setSearch('');
        pagination.reset();
      },
    });
  }
  if (statusFilter !== 'all') {
    chips.push({
      key: 'status',
      label: m.chipStatus(orderStatusLabels()[statusFilter as OrderStatus] ?? statusFilter),
      onRemove: () => {
        setStatusFilter('all');
        pagination.reset();
      },
    });
  }
  if (dateRange.preset) {
    chips.push({
      key: 'date',
      label:
        dateRange.preset === 'custom'
          ? m.chipDate(`${dateRange.from ?? '…'} — ${dateRange.to ?? '…'}`)
          : m.chipDate(DATE_PRESET_LABELS[dateRange.preset]),
      onRemove: () => {
        setDateRange(EMPTY_DATE_RANGE);
        pagination.reset();
      },
    });
  }

  const handleExportCsv = () => {
    if (sortedOrders.length === 0) return;
    // No new API call — the loaded rows on screen are exported.
    const csv = m.csv;
    downloadCsv<Order>(
      `buyurtmalar-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'ID', value: (o) => shortId(o.id) },
        { header: csv.passenger, value: (o) => fullName(o.passenger.firstName, o.passenger.lastName) },
        { header: csv.passengerPhone, value: (o) => o.passenger.phone },
        {
          header: csv.driver,
          value: (o) => (o.driver ? fullName(o.driver.firstName, o.driver.lastName) : ''),
        },
        { header: csv.carNumber, value: (o) => o.driver?.carNumber ?? '' },
        { header: csv.pickup, value: (o) => o.pickupAddress ?? '' },
        { header: csv.dropoff, value: (o) => o.dropoffAddress ?? '' },
        { header: csv.status, value: (o) => orderStatusLabels()[o.status as OrderStatus] ?? o.status },
        { header: csv.price, value: (o) => formatMoney(orderPrice(o)) },
        {
          header: csv.payment,
          value: (o) => paymentMethodLabels()[o.paymentMethod as PaymentMethod] ?? o.paymentMethod,
        },
        { header: csv.date, value: (o) => formatDate(o.createdAt) },
      ],
      sortedOrders
    );
    toast({ title: m.csvDone, description: m.csvRows(sortedOrders.length), variant: 'success' });
  };

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={m.title}
        description={m.total(formatNumber(pagination.total))}
        actions={
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={sortedOrders.length === 0}
            leftIcon={<Download size={14} aria-hidden />}
          >
            {m.csvExport}
          </Button>
        }
      />

      <OrdersTable
        orders={sortedOrders}
        isLoading={isLoading}
        error={error}
        onRetry={fetchOrders}
        sort={sort}
        onSortChange={setSort}
        hasActiveFilters={chips.length > 0}
        onClearFilters={clearAllFilters}
        toolbar={
          <FilterBar
            search={searchInput}
            onSearchChange={handleSearchChange}
            searchPlaceholder={m.searchPlaceholder}
            searchAriaLabel={m.searchAria}
            chips={chips}
            onClearAll={clearAllFilters}
          >
            <DateRangeFilter
              value={dateRange}
              onChange={(v) => {
                setDateRange(v);
                pagination.reset();
              }}
            />
            <Select
              options={statusOptions()}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                pagination.reset();
              }}
              aria-label={mc.statusFilterAlt}
              wrapperClassName="w-48"
            />
          </FilterBar>
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
