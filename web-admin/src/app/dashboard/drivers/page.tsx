'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { FilterChip } from '@/components/ui/FilterChips';
import type { SortState } from '@/components/ui/DataTable';
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton';
import { DriversTable } from '@/components/drivers/DriversTable';
import { driversApi, Driver } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { debounce } from '@/lib/utils';
import { formatDateShort, formatMoney, formatNumber, formatRating, fullName } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { driverRegisteredAt } from '@/lib/driver';
import { driverStatusLabels, type DriverStatus } from '@/lib/constants';
import { t } from '@/locales';

const statusFilterLabels = (): Record<string, string> => ({
  online: driverStatusLabels().online,
  offline: driverStatusLabels().offline,
  pending: driverStatusLabels().pending,
  blocked: driverStatusLabels().blocked,
});

function DriversPageInner() {
  const m = t().drivers.list;
  const mc = t().common;
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const pagination = usePagination(20);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // `?status=pending` — yuqori bar qo'ng'irog'idan chuqur havola.
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const initial = searchParams.get('status');
    return initial && initial in statusFilterLabels() ? initial : 'all';
  });
  const [sort, setSort] = useState<SortState | null>(null);

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
    } catch {
      // Oxirgi muvaffaqiyatli qatorlar ekranda qoladi — banner + retry chiqadi.
      setError(m.loadError);
      toast({ title: mc.error, description: m.loadError, variant: 'error' });
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

  const sortedDrivers = useMemo(() => {
    if (!sort) return drivers;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...drivers].sort((a, b) => {
      switch (sort.key) {
        case 'name':
          return fullName(a.firstName, a.lastName).localeCompare(fullName(b.firstName, b.lastName)) * dir;
        case 'rating':
          return (a.rating - b.rating) * dir;
        case 'trips':
          return (a.totalTrips - b.totalTrips) * dir;
        case 'createdAt':
          return (driverRegisteredAt(a) ?? '').localeCompare(driverRegisteredAt(b) ?? '') * dir;
        default:
          return 0;
      }
    });
  }, [drivers, sort]);

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
      label: m.chipStatus(statusFilterLabels()[statusFilter] ?? statusFilter),
      onRemove: () => {
        setStatusFilter('all');
        pagination.reset();
      },
    });
  }
  const hasActiveFilters = chips.length > 0;

  const handleExportCsv = () => {
    if (sortedDrivers.length === 0) return;
    const csv = m.csv;
    downloadCsv<Driver>(
      `haydovchilar-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: csv.driver, value: (d) => fullName(d.firstName, d.lastName) },
        { header: csv.phone, value: (d) => d.phone },
        { header: csv.car, value: (d) => d.carModel },
        { header: csv.plate, value: (d) => d.carNumber },
        { header: csv.rating, value: (d) => formatRating(d.rating) },
        { header: csv.trips, value: (d) => d.totalTrips },
        {
          header: csv.wallet,
          value: (d) => (d.walletBalance !== undefined ? formatMoney(d.walletBalance) : ''),
        },
        {
          header: csv.status,
          value: (d) => driverStatusLabels()[d.status as DriverStatus] ?? d.status,
        },
        { header: csv.online, value: (d) => (d.isOnline ? csv.yes : csv.no) },
        { header: csv.registered, value: (d) => formatDateShort(driverRegisteredAt(d)) },
      ],
      sortedDrivers
    );
    toast({ title: m.csvDone, description: m.csvRows(sortedDrivers.length), variant: 'success' });
  };

  const statusItems = [
    { value: 'all', label: mc.all },
    ...Object.entries(statusFilterLabels()).map(([value, label]) => ({ value, label })),
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={m.title}
        description={m.total(formatNumber(pagination.total))}
        actions={
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={sortedDrivers.length === 0}
            leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            {m.csvExport}
          </Button>
        }
      />
      <DriversTable
        drivers={sortedDrivers}
        isLoading={isLoading}
        error={error}
        onRetry={fetchDrivers}
        sort={sort}
        onSortChange={setSort}
        hasActiveFilters={hasActiveFilters}
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
            <SegmentedControl
              items={statusItems}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                pagination.reset();
              }}
              ariaLabel={mc.statusFilterAlt}
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

export default function DriversPage() {
  // useSearchParams Next 14 build'ida Suspense chegarasini talab qiladi.
  return (
    <Suspense
      fallback={
        <div className="px-4 sm:px-6 py-5 space-y-5">
          <Skeleton className="h-5 w-40" />
          <SkeletonTable rows={10} cols={8} />
        </div>
      }
    >
      <DriversPageInner />
    </Suspense>
  );
}
