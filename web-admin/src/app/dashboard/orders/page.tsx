'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { OrdersTable } from '@/components/orders/OrdersTable';
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
import { debounce } from '@/lib/utils';
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from '@/lib/constants';

export default function OrdersPage() {
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ordersApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      const payload = res.data.data;
      setOrders(payload?.orders ?? []);
      const total = payload?.total ?? 0;
      pagination.setTotal(total, Math.ceil(total / pagination.limit));
    } catch {
      toast({ title: 'Xatolik', description: 'Buyurtmalarni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, search, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
      pagination.reset();
    }, 400),
    []
  );

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <div>
      <Header
        title="Buyurtmalar"
        subtitle={`Jami: ${pagination.total.toLocaleString()} ta`}
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              placeholder="ID, yo'lovchi yoki haydovchi bo'yicha qidirish..."
              leftIcon={<Search className="h-4 w-4" />}
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v); pagination.reset(); }}
          >
            <SelectTrigger className="w-52">
              <Filter className="mr-2 h-4 w-4 text-gray-400" />
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

        <Card>
          <CardContent className="p-0">
            <OrdersTable
              orders={orders}
              isLoading={isLoading}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {pagination.total} ta natijadan{' '}
            {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} ko&apos;rsatilmoqda
          </p>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            pageRange={pagination.pageRange}
            canGoPrev={pagination.canGoPrev}
            canGoNext={pagination.canGoNext}
            onPageChange={pagination.goToPage}
          />
        </div>
      </div>
    </div>
  );
}
