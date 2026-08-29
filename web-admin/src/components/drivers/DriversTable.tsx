'use client';

import { useRouter } from 'next/navigation';
import { Star, Car } from 'lucide-react';
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
import { Avatar } from '@/components/ui/Avatar';
import { DriverStatusBadge } from './DriverStatusBadge';
import { Driver } from '@/lib/api';
import { formatDate, getFullName, formatRating, formatCurrency } from '@/lib/utils';

interface DriversTableProps {
  drivers: Driver[];
  isLoading: boolean;
}

export function DriversTable({ drivers, isLoading }: DriversTableProps) {
  const router = useRouter();

  if (isLoading) {
    return <SkeletonTable rows={8} cols={8} className="border-0" />;
  }

  if (drivers.length === 0) {
    return (
      <EmptyState
        icon={<Car className="h-6 w-6" />}
        title="Haydovchilar topilmadi"
        description="Filtrni oʻzgartirib koʻring yoki keyinroq qayta urinib koʻring."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Haydovchi</TableHead>
          <TableHead>Telefon</TableHead>
          <TableHead>Avtomobil</TableHead>
          <TableHead>Raqam</TableHead>
          <TableHead>Reyting</TableHead>
          <TableHead>Safarlar</TableHead>
          <TableHead>Holat</TableHead>
          <TableHead>Ro&apos;yxatdan o&apos;tgan</TableHead>
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
                      className={`text-caption ${
                        driver.walletBalance < 0 ? 'text-danger-deep dark:text-danger-light' : 'text-muted'
                      }`}
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
            <TableCell>
              <div className="flex items-center gap-1">
                {/* Reyting yulduzi — amber (docs §5: kWarningDark ga eng yaqin). */}
                <Star className="h-3.5 w-3.5 fill-override text-override" aria-hidden="true" />
                <span className="font-medium text-ink">{formatRating(driver.rating)}</span>
              </div>
            </TableCell>
            <TableCell className="font-mono font-medium tabular-nums text-ink">
              {driver.totalTrips}
            </TableCell>
            <TableCell>
              <DriverStatusBadge status={driver.status} isOnline={driver.isOnline} />
            </TableCell>
            <TableCell className="text-caption text-muted">
              {formatDate(driver.createdAt, 'dd.MM.yyyy')}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
