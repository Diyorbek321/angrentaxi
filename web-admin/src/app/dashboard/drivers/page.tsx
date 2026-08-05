'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Car } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { ErrorState } from '@/components/ui/ErrorState';
import { DriversTable } from '@/components/drivers/DriversTable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { driversApi, Driver } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { debounce } from '@/lib/utils';

export default function DriversPage() {
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof driversApi.getAll>[0] = {
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
      };
      if (statusFilter === 'online') params.isOnline = true;
      else if (statusFilter === 'offline') params.isOnline = false;
      else if (statusFilter !== 'all') params.status = statusFilter;

      const res = await driversApi.getAll(params);
      const payload = res.data.data;
      setDrivers(payload?.drivers ?? []);
      const total = payload?.total ?? 0;
      pagination.setTotal(total, Math.ceil(total / pagination.limit));
    } catch {
      setError('Haydovchilarni yuklashda xatolik');
      toast({ title: 'Xatolik', description: 'Haydovchilarni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, search, statusFilter]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
      pagination.reset();
    }, 400),
    []
  );

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Haydovchilar"
        description={`Jami: ${pagination.total.toLocaleString()} ta`}
        icon={<Car className="h-4 w-4" aria-hidden="true" />}
      />
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              placeholder="Ism, telefon yoki avtomobil raqami bo'yicha qidirish..."
              leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
              onChange={(e) => debouncedSearch(e.target.value)}
              aria-label="Haydovchilarni qidirish"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v); pagination.reset(); }}
          >
            <SelectTrigger className="w-48" aria-label="Holat bo'yicha filtr">
              <SelectValue placeholder="Holat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha holatlar</SelectItem>
              <SelectItem value="online">Onlayn</SelectItem>
              <SelectItem value="offline">Oflayn</SelectItem>
              <SelectItem value="pending">Ko&apos;rib chiqilmoqda</SelectItem>
              <SelectItem value="blocked">Bloklangan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && !isLoading ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState message={error} onRetry={fetchDrivers} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <DriversTable drivers={drivers} isLoading={isLoading} />
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <p className="text-body text-muted">
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
