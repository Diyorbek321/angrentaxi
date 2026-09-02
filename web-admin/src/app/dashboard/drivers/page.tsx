'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Car, Download, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChips, type FilterChip } from '@/components/ui/FilterChips';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { DriversTable, type DriverSortDir } from '@/components/drivers/DriversTable';
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
import { debounce, formatCurrency, formatDate, formatRating, getFullName } from '@/lib/utils';
import { downloadCsv } from '@/lib/csv';
import { DRIVER_STATUS_LABELS, type DriverStatus } from '@/lib/constants';

const STATUS_FILTER_LABELS: Record<string, string> = {
  online: DRIVER_STATUS_LABELS.online,
  offline: DRIVER_STATUS_LABELS.offline,
  pending: DRIVER_STATUS_LABELS.pending,
  blocked: DRIVER_STATUS_LABELS.blocked,
};

function DriversPageInner() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const pagination = usePagination(20);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // `?status=pending` — yuqori bar qo'ng'irog'idan chuqur havola.
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const initial = searchParams.get('status');
    return initial && initial in STATUS_FILTER_LABELS ? initial : 'all';
  });
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<DriverSortDir>(null);

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
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
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      // Oxirgi muvaffaqiyatli qatorlar ekranda qoladi — banner + retry chiqadi.
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
      setSortField(null);
      setSortDir(null);
    }
  };

  const sortedDrivers = useMemo(() => {
    if (!sortField || !sortDir) return drivers;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...drivers].sort((a, b) => {
      switch (sortField) {
        case 'name':
          return getFullName(a.firstName, a.lastName).localeCompare(
            getFullName(b.firstName, b.lastName)
          ) * dir;
        case 'rating':
          return (a.rating - b.rating) * dir;
        case 'trips':
          return (a.totalTrips - b.totalTrips) * dir;
        case 'createdAt':
          return a.createdAt.localeCompare(b.createdAt) * dir;
        default:
          return 0;
      }
    });
  }, [drivers, sortField, sortDir]);

  const clearAllFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('all');
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
      label: `Holat: ${STATUS_FILTER_LABELS[statusFilter] ?? statusFilter}`,
      onRemove: () => {
        setStatusFilter('all');
        pagination.reset();
      },
    });
  }
  const hasActiveFilters = chips.length > 0;

  const handleExportCsv = () => {
    if (sortedDrivers.length === 0) return;
    downloadCsv<Driver>(
      `haydovchilar-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'Haydovchi', value: (d) => getFullName(d.firstName, d.lastName) },
        { header: 'Telefon', value: (d) => d.phone },
        { header: 'Avtomobil', value: (d) => d.carModel },
        { header: 'Raqam', value: (d) => d.carNumber },
        { header: 'Reyting', value: (d) => formatRating(d.rating) },
        { header: 'Safarlar', value: (d) => d.totalTrips },
        {
          header: 'Hamyon',
          value: (d) => (d.walletBalance !== undefined ? formatCurrency(d.walletBalance) : ''),
        },
        {
          header: 'Holat',
          value: (d) => DRIVER_STATUS_LABELS[d.status as DriverStatus] ?? d.status,
        },
        { header: 'Onlayn', value: (d) => (d.isOnline ? 'Ha' : "Yo'q") },
        { header: "Ro'yxatdan o'tgan", value: (d) => formatDate(d.createdAt, 'dd.MM.yyyy') },
      ],
      sortedDrivers
    );
    toast({ title: 'CSV yuklab olindi', description: `${sortedDrivers.length} ta qator`, variant: 'success' });
  };

  const showFullError = error && !isLoading && drivers.length === 0 && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && !showFullError;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Haydovchilar"
        description={`Jami: ${pagination.total.toLocaleString('uz-UZ')} ta`}
        icon={<Car className="h-4 w-4" aria-hidden="true" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={sortedDrivers.length === 0}
            leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            CSV eksport
          </Button>
        }
      />
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              placeholder="Ism, telefon yoki avtomobil raqami bo'yicha qidirish..."
              leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
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
              <SelectItem value="online">{DRIVER_STATUS_LABELS.online}</SelectItem>
              <SelectItem value="offline">{DRIVER_STATUS_LABELS.offline}</SelectItem>
              <SelectItem value="pending">{DRIVER_STATUS_LABELS.pending}</SelectItem>
              <SelectItem value="blocked">{DRIVER_STATUS_LABELS.blocked}</SelectItem>
            </SelectContent>
          </Select>
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
            <Button variant="secondary" size="sm" onClick={fetchDrivers}>
              Qayta urinish
            </Button>
          </div>
        )}

        {showFullError ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState message={error} onRetry={fetchDrivers} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <DriversTable
                drivers={sortedDrivers}
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

export default function DriversPage() {
  // useSearchParams Next 14 build'ida Suspense chegarasini talab qiladi.
  return (
    <Suspense
      fallback={
        <div className="p-4 sm:p-6">
          <SkeletonTable rows={8} cols={8} />
        </div>
      }
    >
      <DriversPageInner />
    </Suspense>
  );
}
