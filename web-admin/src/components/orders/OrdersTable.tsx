'use client';

import { useRouter } from 'next/navigation';
import { ArrowUpDown, ClipboardList } from 'lucide-react';
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
import { OrderStatusBadge } from './OrderStatusBadge';
import { Order } from '@/lib/api';
import { cn, formatCurrency, formatDate, shortId, getFullName } from '@/lib/utils';
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

  const SortableHead = ({ field, children }: { field: string; children: React.ReactNode }) => {
    const active = sortField === field;
    return (
      // `aria-sort` — tartiblash holati ekran o'quvchiga ham yetkaziladi,
      // ma'no faqat ikonka rangi bilan berilmaydi.
      <TableHead aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => onSort?.(field)}
          className={cn(
            'flex items-center gap-1 text-micro uppercase transition-colors duration-fast',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2',
            active ? 'text-primary-text' : 'text-muted hover:text-ink'
          )}
        >
          {children}
          <ArrowUpDown
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

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-6 w-6" />}
        title="Buyurtmalar topilmadi"
        description="Tanlangan filtr boʻyicha buyurtma yoʻq."
      />
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
            <TableCell className="font-mono text-caption text-muted">
              #{shortId(order.id)}
            </TableCell>
            <TableCell>
              <div>
                <p className="font-medium text-ink">
                  {getFullName(order.passenger.firstName, order.passenger.lastName)}
                </p>
                <p className="text-caption text-muted">{order.passenger.phone}</p>
              </div>
            </TableCell>
            <TableCell>
              {order.driver ? (
                <div>
                  <p className="font-medium text-ink">
                    {getFullName(order.driver.firstName, order.driver.lastName)}
                  </p>
                  <p className="text-caption text-muted">{order.driver.carNumber}</p>
                </div>
              ) : (
                <span className="text-caption text-subtle">—</span>
              )}
            </TableCell>
            <TableCell className="max-w-[200px]">
              <p className="truncate text-caption text-ink">{order.pickupAddress ?? '—'}</p>
              <p className="truncate text-caption text-muted">{order.dropoffAddress ?? '—'}</p>
            </TableCell>
            <TableCell>
              <OrderStatusBadge status={order.status} />
            </TableCell>
            <TableCell className="font-mono font-medium tabular-nums text-ink">
              {formatCurrency(order.finalPrice ?? order.estimatedPrice)}
            </TableCell>
            <TableCell>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-caption text-muted">
                {PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod] ?? order.paymentMethod}
              </span>
            </TableCell>
            <TableCell className="text-caption text-muted">{formatDate(order.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
