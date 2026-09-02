'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Filter, ClipboardList, Download, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChips, type FilterChip } from '@/components/ui/FilterChips';
import { PaginationBar } from '@/components/ui/PaginationBar';
import {
  DateRangeFilter,
  DATE_PRESET_LABELS,
  EMPTY_DATE_RANGE,
  type DateRangeValue,
} from '@/components/ui/DateRangeFilter';
import { OrdersTable, type OrderSortDir } from '@/components/orders/OrdersTable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { ordersApi, Order } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { debounce, formatCurrency, formatDate, getFullName, shortId } from '@/lib/utils';
import { downloadCsv } from '@/lib/csv';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type OrderStatus,
  type PaymentMethod,
} from '@/lib/constants';

export default function OrdersPage() {
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>(EMPTY_DATE_RANGE);
  // Tartiblash uch holatli: asc → desc → tozalash (server tartibi = eng
  // yangisi birinchi). Sahifadagi yuklangan qatorlar ustida, mijoz tomonida.
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<OrderSortDir>(null);

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
      setHasLoadedOnce(true);
    } catch {
      // Oxirgi muvaffaqiyatli qatorlar EKRANDA QOLADI — jimgina nol qator
      // ko'rsatgan jadval yolg'on gapiradi. Xato banner + retry chiqadi.
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

  const handleSort = (field: string) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      // Uchinchi bosish — tartiblash tozalanadi, standart (eng yangi birinchi).
      setSortField(null);
      setSortDir(null);
    }
  };

  const sortedOrders = useMemo(() => {
    if (!sortField || !sortDir) return orders;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...orders].sort((a, b) => {
      switch (sortField) {
        case 'id':
          return a.id.localeCompare(b.id) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'price':
          return (
            ((a.finalPrice ?? a.estimatedPrice) - (b.finalPrice ?? b.estimatedPrice)) * dir
          );
        case 'createdAt':
          return a.createdAt.localeCompare(b.createdAt) * dir;
        default:
          return 0;
      }
    });
  }, [orders, sortField, sortDir]);

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
  const hasActiveFilters = chips.length > 0;

  const handleExportCsv = () => {
    if (sortedOrders.length === 0) return;
    // Yangi API chaqirig'i YO'Q — ekrandagi yuklangan qatorlar eksport qilinadi.
    downloadCsv<Order>(
      `buyurtmalar-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'ID', value: (o) => shortId(o.id) },
        { header: "Yo'lovchi", value: (o) => getFullName(o.passenger.firstName, o.passenger.lastName) },
        { header: "Yo'lovchi telefoni", value: (o) => o.passenger.phone },
        {
          header: 'Haydovchi',
          value: (o) => (o.driver ? getFullName(o.driver.firstName, o.driver.lastName) : ''),
        },
        { header: 'Avtomobil raqami', value: (o) => o.driver?.carNumber ?? '' },
        { header: "Boshlang'ich manzil", value: (o) => o.pickupAddress ?? '' },
        { header: 'Manzil', value: (o) => o.dropoffAddress ?? '' },
        { header: 'Holat', value: (o) => ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status },
        { header: 'Narx', value: (o) => formatCurrency(o.finalPrice ?? o.estimatedPrice) },
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

  const showFullError = error && !isLoading && orders.length === 0 && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && !showFullError;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Buyurtmalar"
        description={`Jami: ${pagination.total.toLocaleString('uz-UZ')} ta`}
        icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={sortedOrders.length === 0}
            leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            CSV eksport
          </Button>
        }
      />
      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex-1">
            <Input
              placeholder="ID, yo'lovchi yoki haydovchi bo'yicha qidirish..."
              leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-label="Buyurtmalarni qidirish"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DateRangeFilter
              value={dateRange}
              onChange={(v) => {
                setDateRange(v);
                pagination.reset();
              }}
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => { setStatusFilter(v); pagination.reset(); }}
            >
              <SelectTrigger className="w-52" aria-label="Holat bo'yicha filtr">
                <Filter className="mr-2 h-4 w-4 text-subtle" aria-hidden="true" />
                <SelectValue placeholder="Holat bo'yicha filtr" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha holatlar</SelectItem>
                {Object.entries(ORDER_STATUSES).map(([, value]) => (
                  <SelectItem key={value} value={value}>
                    {ORDER_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <FilterChips chips={chips} onClearAll={clearAllFilters} />

        {showErrorBanner && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-4 py-3"
          >
            <p className="flex items-center gap-2 text-body text-danger-deep dark:text-danger-light">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error} — oxirgi muvaffaqiyatli yuklangan ma&apos;lumot ko&apos;rsatilmoqda.
            </p>
            <Button variant="secondary" size="sm" onClick={fetchOrders}>
              Qayta urinish
            </Button>
          </div>
        )}

        {showFullError ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState message={error} onRetry={fetchOrders} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <OrdersTable
                orders={sortedOrders}
                isLoading={isLoading}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={clearAllFilters}
              />
            </CardContent>
          </Card>
        )}

        <PaginationBar
          page={pagination.page}
          limit={pagination.limit}
          total={pagination.total}
          totalPages={pagination.totalPages}
          pageRange={pagination.pageRange}
          canGoPrev={pagination.canGoPrev}
          canGoNext={pagination.canGoNext}
          onPageChange={pagination.goToPage}
          onLimitChange={pagination.setLimit}
        />
      </div>
    </div>
  );
}
