'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, RefreshCw, Search } from 'lucide-react';
import { getOrders, PaginatedResponse, Order } from '@/lib/api';
import { OrderStatus, ORDER_STATUS, ORDER_STATUS_LABELS } from '@/lib/constants';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatNumber } from '@/lib/format';

const statusOptions = [
  { value: '', label: 'Barcha statuslar' },
  ...Object.values(ORDER_STATUS).map((status) => ({
    value: status,
    label: ORDER_STATUS_LABELS[status],
  })),
];

const PAGE_LIMIT = 20;

function OrdersPageContent() {
  // The header search box routes here with ?q=… — pick it up as the initial
  // query so the search feels continuous across screens.
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [data, setData] = useState<PaginatedResponse<Order> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
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
    setError(null);
    try {
      const result = await getOrders({
        page: currentPage,
        limit: PAGE_LIMIT,
        status: statusFilter ? (statusFilter as OrderStatus) : undefined,
        search: debouncedSearch || undefined,
      });
      setData(result);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError('Buyurtmalarni yuklab boʻlmadi. Qaytadan urinib koʻring.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearch]);

  const hasFilters = Boolean(statusFilter || searchQuery);

  const clearFilters = () => {
    setStatusFilter('');
    setSearchQuery('');
  };

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
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchOrders}
              leftIcon={<RefreshCw size={13} />}
            >
              Yangilash
            </Button>
          }
        />

        <div className="flex items-center gap-3 flex-wrap pb-4">
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
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Filtrlarni tozalash
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {error ? (
          <ErrorState title="Buyurtmalarni yuklab boʻlmadi" message={error} onRetry={fetchOrders} />
        ) : (
          <OrdersTable
            data={
              data ?? {
                data: [],
                total: 0,
                page: 1,
                limit: PAGE_LIMIT,
                totalPages: 0,
              }
            }
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            isLoading={isLoading}
            hasFilters={hasFilters}
            onClearFilters={clearFilters}
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
          <SkeletonTable rows={8} cols={6} />
        </div>
      }
    >
      <OrdersPageContent />
    </Suspense>
  );
}
