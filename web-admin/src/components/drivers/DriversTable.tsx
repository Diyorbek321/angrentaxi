'use client';

import { useRouter } from 'next/navigation';
import { Car } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { DataTable, type DataTableColumn, type SortState } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import { PlateNumber } from '@/components/ui/PlateNumber';
import type { PaginationProps } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { DriverStatusBadge } from './DriverStatusBadge';
import { legalBriefBadge } from '@/lib/driver-legal';
import type { Driver } from '@/lib/api';
import { formatDateShort, formatNumber, formatPhone, formatRating, fullName } from '@/lib/format';
import { driverRegisteredAt } from '@/lib/driver';
import { t } from '@/locales';

interface DriversTableProps {
  drivers: Driver[];
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  pagination?: PaginationProps;
  toolbar?: React.ReactNode;
}

function buildColumns(): DataTableColumn<Driver>[] {
  const m = t().drivers.table;
  return [
    {
      key: 'name',
      header: m.driver,
      sortable: true,
      cell: (d) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar firstName={d.firstName} lastName={d.lastName} size="sm" />
          <span className="font-medium text-ink truncate max-w-[220px]">{fullName(d.firstName, d.lastName)}</span>
        </div>
      ),
    },
    {
      key: 'phone',
      header: m.phone,
      hideBelow: 'xl',
      className: 'num whitespace-nowrap text-muted',
      cell: (d) => formatPhone(d.phone),
    },
    {
      key: 'car',
      header: m.car,
      hideBelow: 'xl',
      cell: (d) => (
        <span className="whitespace-nowrap">
          {d.carModel || '—'}
          {d.carColor && <span className="text-muted"> · {d.carColor}</span>}
        </span>
      ),
    },
    { key: 'plate', header: m.plate, cell: (d) => <PlateNumber plate={d.carNumber} /> },
    {
      key: 'rating',
      header: m.rating,
      numeric: true,
      sortable: true,
      cell: (d) => formatRating(d.rating),
    },
    {
      key: 'trips',
      header: m.trips,
      numeric: true,
      sortable: true,
      cell: (d) => formatNumber(d.totalTrips),
    },
    {
      key: 'balance',
      header: m.balance,
      numeric: true,
      cell: (d) => (d.walletBalance !== undefined ? <MoneyText value={d.walletBalance} signed /> : '—'),
    },
    {
      key: 'status',
      header: m.status,
      cell: (d) => <DriverStatusBadge status={d.status} isOnline={d.isOnline} />,
    },
    {
      key: 'legal',
      header: m.legal,
      hideBelow: 'lg',
      cell: (d) => {
        const badge = legalBriefBadge(d.legal);
        return (
          <span title={badge.title}>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      header: m.registered,
      sortable: true,
      hideBelow: 'xl',
      className: 'num whitespace-nowrap text-muted',
      cell: (d) => formatDateShort(driverRegisteredAt(d)),
    },
  ];
}

export function DriversTable({
  drivers,
  isLoading,
  error,
  onRetry,
  sort,
  onSortChange,
  hasActiveFilters = false,
  onClearFilters,
  pagination,
  toolbar,
}: DriversTableProps) {
  const router = useRouter();
  const m = t().drivers.table;
  return (
    <DataTable
      ariaLabel={m.ariaLabel}
      columns={buildColumns()}
      rows={drivers}
      rowKey={(d) => d.id}
      loading={isLoading}
      error={error}
      onRetry={onRetry}
      sort={sort}
      onSortChange={onSortChange}
      onRowClick={(d) => router.push(`/dashboard/drivers/${d.id}`)}
      maxHeightClassName="max-h-[calc(100vh-260px)]"
      pagination={pagination}
      toolbar={toolbar}
      isFiltered={hasActiveFilters}
      onClearFilters={onClearFilters}
      emptyFiltered={{ title: m.emptyFilteredTitle, description: m.emptyFilteredDescription }}
      empty={{
        variant: 'first-use',
        icon: <Car aria-hidden />,
        title: m.emptyTitle,
        description: m.emptyDescription,
      }}
    />
  );
}
