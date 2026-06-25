'use client';

import { useRouter } from 'next/navigation';
import { ArrowUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { OrderStatusBadge } from './OrderStatusBadge';
import { Order } from '@/lib/api';
import { formatCurrency, formatDate, shortId, getFullName } from '@/lib/utils';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '@/lib/constants';

interface OrdersTableProps {
  orders: Order[];
  isLoading: boolean;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}

export function OrdersTable({ orders, isLoading, sortField, sortDir, onSort }: OrdersTableProps) {
  const router = useRouter();

  const SortableHead = ({
    field,
    children,
  }: {
    field: string;
    children: React.ReactNode;
  }) => (
    <TableHead>
      <button
        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
        onClick={() => onSort?.(field)}
      >
        {children}
        <ArrowUpDown
          className={`h-3 w-3 ${sortField === field ? 'text-brand-yellow' : 'text-gray-300'}`}
        />
      </button>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-gray-500">Buyurtmalar topilmadi</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead field="id">ID</SortableHead>
          <TableHead>Yo&apos;lovchi</TableHead>
          <TableHead>Haydovchi</TableHead>
          <TableHead>Manzil</TableHead>
          <SortableHead field="status">Holat</SortableHead>
          <SortableHead field="price">Narx</SortableHead>
          <TableHead>To&apos;lov</TableHead>
          <SortableHead field="createdAt">Sana</SortableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow
            key={order.id}
            className="cursor-pointer"
            onClick={() => router.push(`/dashboard/orders/${order.id}`)}
          >
            <TableCell className="font-mono text-xs text-gray-500">
              #{shortId(order.id)}
            </TableCell>
            <TableCell>
              <div>
                <p className="font-medium text-gray-900">
                  {getFullName(order.passenger.firstName, order.passenger.lastName)}
                </p>
                <p className="text-xs text-gray-500">{order.passenger.phone}</p>
              </div>
            </TableCell>
            <TableCell>
              {order.driver ? (
                <div>
                  <p className="font-medium text-gray-900">
                    {getFullName(order.driver.firstName, order.driver.lastName)}
                  </p>
                  <p className="text-xs text-gray-500">{order.driver.carNumber}</p>
                </div>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              )}
            </TableCell>
            <TableCell className="max-w-[200px]">
              <p className="truncate text-xs text-gray-700">{order.fromAddress}</p>
              <p className="truncate text-xs text-gray-500">{order.toAddress}</p>
            </TableCell>
            <TableCell>
              <OrderStatusBadge status={order.status} />
            </TableCell>
            <TableCell className="font-medium text-gray-900">
              {formatCurrency(order.price)}
            </TableCell>
            <TableCell>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod] ?? order.paymentMethod}
              </span>
            </TableCell>
            <TableCell className="text-xs text-gray-500">
              {formatDate(order.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
