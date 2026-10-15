'use client';

import { useRouter } from 'next/navigation';
import { Car } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { DataTable, type DataTableColumn, type SortState } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import { PlateNumber } from '@/components/ui/PlateNumber';
import type { PaginationProps } from '@/components/ui/Pagination';
import { DriverStatusBadge } from './DriverStatusBadge';
import type { Driver } from '@/lib/api';
import { formatDateShort, formatNumber, formatPhone, formatRating, fullName } from '@/lib/format';
import { driverRegisteredAt } from '@/lib/driver';

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

const columns: DataTableColumn<Driver>[] = [
  {
    key: 'name',
    header: 'Haydovchi',
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
    header: 'Telefon',
    hideBelow: 'xl',
    className: 'num whitespace-nowrap text-muted',
    cell: (d) => formatPhone(d.phone),
  },
  {
    key: 'car',
    header: 'Avtomobil',
    hideBelow: 'xl',
    cell: (d) => (
      <span className="whitespace-nowrap">
        {d.carModel || '—'}
        {d.carColor && <span className="text-muted"> · {d.carColor}</span>}
      </span>
    ),
  },
  { key: 'plate', header: 'Raqam', cell: (d) => <PlateNumber plate={d.carNumber} /> },
  {
    key: 'rating',
    header: 'Reyting',
    numeric: true,
    sortable: true,
    cell: (d) => formatRating(d.rating),
  },
  {
    key: 'trips',
    header: 'Safarlar',
    numeric: true,
    sortable: true,
    cell: (d) => formatNumber(d.totalTrips),
  },
  {
    key: 'balance',
    header: 'Balans',
    numeric: true,
    cell: (d) => (d.walletBalance !== undefined ? <MoneyText value={d.walletBalance} signed /> : '—'),
  },
  {
    key: 'status',
    header: 'Holat',
    cell: (d) => <DriverStatusBadge status={d.status} isOnline={d.isOnline} />,
  },
  {
    key: 'createdAt',
    header: 'Roʻyxatdan oʻtgan',
    sortable: true,
    hideBelow: 'xl',
    className: 'num whitespace-nowrap text-muted',
    cell: (d) => formatDateShort(driverRegisteredAt(d)),
  },
];

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
  return (
    <DataTable
      ariaLabel="Haydovchilar"
      columns={columns}
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
      emptyFiltered={{ title: 'Hech narsa mos kelmadi', description: 'Tanlangan filtrlar boʻyicha haydovchi topilmadi.' }}
      empty={{
        variant: 'first-use',
        icon: <Car aria-hidden />,
        title: 'Hozircha haydovchilar yoʻq',
        description: 'Haydovchilar ilova orqali roʻyxatdan oʻtishi bilan shu jadvalda koʻrinadi.',
      }}
    />
  );
}
