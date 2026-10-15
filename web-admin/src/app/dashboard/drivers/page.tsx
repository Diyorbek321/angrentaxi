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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // `?status=pending` — yuqori bar qo'ng'irog'idan chuqur havola.
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const initial = searchParams.get('status');
    return initial && initial in STATUS_FILTER_LABELS ? initial : 'all';
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
        { header: 'Haydovchi', value: (d) => fullName(d.firstName, d.lastName) },
        { header: 'Telefon', value: (d) => d.phone },
        { header: 'Avtomobil', value: (d) => d.carModel },
        { header: 'Raqam', value: (d) => d.carNumber },
        { header: 'Reyting', value: (d) => formatRating(d.rating) },
        { header: 'Safarlar', value: (d) => d.totalTrips },
        {
          header: 'Hamyon',
          value: (d) => (d.walletBalance !== undefined ? formatMoney(d.walletBalance) : ''),
        },
        {
          header: 'Holat',
          value: (d) => DRIVER_STATUS_LABELS[d.status as DriverStatus] ?? d.status,
        },
        { header: 'Onlayn', value: (d) => (d.isOnline ? 'Ha' : "Yo'q") },
        { header: "Ro'yxatdan o'tgan", value: (d) => formatDateShort(driverRegisteredAt(d)) },
      ],
      sortedDrivers
    );
    toast({ title: 'CSV yuklab olindi', description: `${sortedDrivers.length} ta qator`, variant: 'success' });
  };

  const statusItems = [
    { value: 'all', label: 'Hammasi' },
    ...Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => ({ value, label })),
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Haydovchilar"
        description={`Jami: ${formatNumber(pagination.total)} ta`}
        actions={
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={sortedDrivers.length === 0}
            leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            CSV eksport
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
            searchPlaceholder="Ism, telefon yoki raqam…"
            searchAriaLabel="Haydovchilarni qidirish"
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
              ariaLabel="Holat boʻyicha filtr"
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
