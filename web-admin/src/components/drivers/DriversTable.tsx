'use client';

import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
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
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (drivers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-gray-500">Haydovchilar topilmadi</p>
      </div>
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-sm font-bold text-brand-black">
                  {driver.firstName?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {getFullName(driver.firstName, driver.lastName)}
                  </p>
                  {driver.balance !== undefined && (
                    <p className="text-xs text-gray-500">{formatCurrency(driver.balance)}</p>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-gray-600">{driver.phone}</TableCell>
            <TableCell>
              <p className="font-medium text-gray-900">{driver.carModel}</p>
              <p className="text-xs text-gray-500">{driver.carColor}</p>
            </TableCell>
            <TableCell>
              <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs font-semibold text-gray-700">
                {driver.carNumber}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-brand-yellow text-brand-yellow" />
                <span className="text-sm font-medium text-gray-900">
                  {formatRating(driver.rating)}
                </span>
              </div>
            </TableCell>
            <TableCell className="font-medium text-gray-900">{driver.totalTrips}</TableCell>
            <TableCell>
              <DriverStatusBadge status={driver.status} isOnline={driver.isOnline} />
            </TableCell>
            <TableCell className="text-xs text-gray-500">
              {formatDate(driver.createdAt, 'dd.MM.yyyy')}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
