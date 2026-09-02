'use client';

import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown, Star, Car, SearchX } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { DriverStatusBadge } from './DriverStatusBadge';
import { Driver } from '@/lib/api';
import { cn, formatDate, getFullName, formatRating, formatCurrency } from '@/lib/utils';

export type DriverSortDir = 'asc' | 'desc' | null;

interface DriversTableProps {
  drivers: Driver[];
  isLoading: boolean;
  sortField?: string | null;
  sortDir?: DriverSortDir;
  onSort?: (field: string) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export function DriversTable({
  drivers,
  isLoading,
  sortField,
  sortDir,
  onSort,
  hasActiveFilters = false,
  onClearFilters,
}: DriversTableProps) {
  const router = useRouter();

  const SortableHead = ({
    field,
    children,
    align = 'left',
  }: {
    field: string;
    children: React.ReactNode;
    align?: 'left' | 'right';
  }) => {
    const active = sortField === field && !!sortDir;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <TableHead
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={align === 'right' ? 'text-right' : undefined}
      >
        <button
          type="button"
          onClick={() => onSort?.(field)}
          className={cn(
            'inline-flex items-center gap-1 text-micro uppercase transition-colors duration-fast',
            align === 'right' && 'flex-row-reverse',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2',
            active ? 'text-primary-text' : 'text-muted hover:text-ink'
          )}
        >
          {children}
          <Icon
            className={cn('h-3 w-3', active ? 'text-primary-text' : 'text-subtle')}
            aria-hidden="true"
          />
        </button>
      </TableHead>
    );
  };

  if (isLoading) {
    return <SkeletonTable rows={8} cols={8} className="border-0" />;
  }

  if (drivers.length === 0) {
    if (hasActiveFilters) {
      return (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="Hech narsa mos kelmadi"
          description="Tanlangan filtrlar bo'yicha haydovchi topilmadi."
          action={
            onClearFilters && (
              <Button variant="secondary" size="sm" onClick={onClearFilters}>
                Filtrlarni tozalash
              </Button>
            )
          }
        />
      );
    }
    return (
      <EmptyState
        icon={<Car className="h-6 w-6" />}
        title="Hozircha haydovchilar yo'q"
        description="Haydovchilar ilova orqali ro'yxatdan o'tishi bilan shu jadvalda ko'rinadi."
      />
    );
  }

  return (
    <Table stickyHeader containerClassName="max-h-[65vh]">
      <TableHeader>
        <TableRow>
          <SortableHead field="name">Haydovchi</SortableHead>
          <TableHead>Telefon</TableHead>
          <TableHead>Avtomobil</TableHead>
          <TableHead>Raqam</TableHead>
          <SortableHead field="rating" align="right">
            Reyting
          </SortableHead>
          <SortableHead field="trips" align="right">
            Safarlar
          </SortableHead>
          <TableHead>Holat</TableHead>
          <SortableHead field="createdAt">Ro&apos;yxatdan o&apos;tgan</SortableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {drivers.map((driver) => (
          <TableRow
            key={driver.id}
            className="cursor-pointer"
            onClick={() => router.push(`/dashboard/drivers/${driver.id}`)}
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar name={getFullName(driver.firstName, driver.lastName)} size="md" />
                <div>
                  <p className="font-medium text-ink">
                    {getFullName(driver.firstName, driver.lastName)}
                  </p>
                  {driver.walletBalance !== undefined && (
                    <p
                      className={cn(
                        'text-caption tabular-nums',
                        driver.walletBalance < 0
                          ? 'text-danger-deep dark:text-danger-light'
                          : 'text-muted'
                      )}
                    >
                      {formatCurrency(driver.walletBalance)}
                    </p>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-muted">{driver.phone}</TableCell>
            <TableCell>
              <p className="font-medium text-ink">{driver.carModel}</p>
              {driver.carColor && <p className="text-caption text-muted">{driver.carColor}</p>}
            </TableCell>
            <TableCell>
              <span className="rounded-ds-xs bg-surface-2 px-2 py-1 font-mono text-caption font-semibold text-ink">
                {driver.carNumber}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <div className="inline-flex items-center gap-1">
                {/* Reyting yulduzi — amber (docs §5: kWarningDark ga eng yaqin). */}
                <Star className="h-3.5 w-3.5 fill-override text-override" aria-hidden="true" />
                <span className="font-medium tabular-nums text-ink">
                  {formatRating(driver.rating)}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right font-mono font-medium tabular-nums text-ink">
              {driver.totalTrips}
            </TableCell>
            <TableCell>
              <DriverStatusBadge status={driver.status} isOnline={driver.isOnline} />
            </TableCell>
            <TableCell className="text-caption tabular-nums text-muted">
              {formatDate(driver.createdAt, 'dd.MM.yyyy')}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
