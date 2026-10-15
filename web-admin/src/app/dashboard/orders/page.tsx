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
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type OrderStatus,
  type PaymentMethod,
} from '@/lib/constants';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Barcha holatlar' },
  ...Object.values(ORDER_STATUSES).map((value) => ({ value, label: ORDER_STATUS_LABELS[value] })),
];

export default function OrdersPage() {
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
      setError('Buyurtmalarni yuklashda xatolik');
      toast({ title: 'Xatolik', description: 'Buyurtmalarni yuklashda xatolik', variant: 'error' });
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
      label: `Qidiruv: "${search}"`,
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
      label: `Holat: ${ORDER_STATUS_LABELS[statusFilter as OrderStatus] ?? statusFilter}`,
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
          ? `Sana: ${dateRange.from ?? '…'} — ${dateRange.to ?? '…'}`
          : `Sana: ${DATE_PRESET_LABELS[dateRange.preset]}`,
      onRemove: () => {
        setDateRange(EMPTY_DATE_RANGE);
        pagination.reset();
      },
    });
  }

  const handleExportCsv = () => {
    if (sortedOrders.length === 0) return;
    // No new API call — the loaded rows on screen are exported.
    downloadCsv<Order>(
      `buyurtmalar-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'ID', value: (o) => shortId(o.id) },
        { header: "Yo'lovchi", value: (o) => fullName(o.passenger.firstName, o.passenger.lastName) },
        { header: "Yo'lovchi telefoni", value: (o) => o.passenger.phone },
        {
          header: 'Haydovchi',
          value: (o) => (o.driver ? fullName(o.driver.firstName, o.driver.lastName) : ''),
        },
        { header: 'Avtomobil raqami', value: (o) => o.driver?.carNumber ?? '' },
        { header: "Boshlang'ich manzil", value: (o) => o.pickupAddress ?? '' },
        { header: 'Manzil', value: (o) => o.dropoffAddress ?? '' },
        { header: 'Holat', value: (o) => ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status },
        { header: 'Narx', value: (o) => formatMoney(orderPrice(o)) },
        {
          header: "To'lov",
          value: (o) => PAYMENT_METHOD_LABELS[o.paymentMethod as PaymentMethod] ?? o.paymentMethod,
        },
        { header: 'Sana', value: (o) => formatDate(o.createdAt) },
      ],
      sortedOrders
    );
    toast({ title: 'CSV yuklab olindi', description: `${sortedOrders.length} ta qator`, variant: 'success' });
  };

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Buyurtmalar"
        description={`Jami: ${formatNumber(pagination.total)} ta`}
        actions={
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={sortedOrders.length === 0}
            leftIcon={<Download size={14} aria-hidden />}
          >
            CSV eksport
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
            searchPlaceholder="ID, yoʻlovchi yoki haydovchi…"
            searchAriaLabel="Buyurtmalarni qidirish"
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
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                pagination.reset();
              }}
              aria-label="Holat boʻyicha filtr"
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
