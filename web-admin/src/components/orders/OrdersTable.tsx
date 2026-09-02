'use client';

import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown, ClipboardList, SearchX } from 'lucide-react';
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
import { OrderStatusBadge } from './OrderStatusBadge';
import { Order } from '@/lib/api';
import { cn, formatCurrency, formatDate, shortId, getFullName } from '@/lib/utils';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '@/lib/constants';

export type OrderSortDir = 'asc' | 'desc' | null;

interface OrdersTableProps {
  orders: Order[];
  isLoading: boolean;
  sortField?: string | null;
  sortDir?: OrderSortDir;
  onSort?: (field: string) => void;
  /** Bo'sh natija sababi filtrmi — bo'sh holat matni shunga qarab tanlanadi. */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export function OrdersTable({
  orders,
  isLoading,
  sortField,
  sortDir,
  onSort,
  hasActiveFilters = false,
  onClearFilters,
}: OrdersTableProps) {
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
    // Indikator uch narsani aytadi: tartiblasa bo'ladimi (muted o'q),
    // qaysi ustun faol va qaysi yo'nalishda (to'liq o'q).
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      // `aria-sort` — tartiblash holati ekran o'quvchiga ham yetkaziladi,
      // ma'no faqat ikonka rangi bilan berilmaydi.
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
    // Skeleton jadval tartibini takrorlaydi — markazlashgan spinner emas.
    return <SkeletonTable rows={8} cols={8} className="border-0" />;
  }

  if (orders.length === 0) {
    // Uch xil bo'sh holat: filtr sabab bo'lsa — "tozalash" harakati bilan;
    // birinchi foydalanish bo'lsa — tushuntirish bilan.
    if (hasActiveFilters) {
      return (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="Hech narsa mos kelmadi"
          description="Tanlangan filtrlar bo'yicha buyurtma topilmadi."
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
        icon={<ClipboardList className="h-6 w-6" />}
        title="Hozircha buyurtmalar yo'q"
        description="Yo'lovchilar buyurtma berishi bilan ular shu jadvalda paydo bo'ladi."
      />
    );
  }

  return (
    <Table stickyHeader containerClassName="max-h-[65vh]">
      <TableHeader>
        <TableRow>
          <SortableHead field="id">ID</SortableHead>
          <TableHead>Yo&apos;lovchi</TableHead>
          <TableHead>Haydovchi</TableHead>
          <TableHead>Manzil</TableHead>
          <SortableHead field="status">Holat</SortableHead>
          <SortableHead field="price" align="right">
            Narx
          </SortableHead>
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
            <TableCell className="text-right font-mono font-medium tabular-nums text-ink">
              {formatCurrency(order.finalPrice ?? order.estimatedPrice)}
            </TableCell>
            <TableCell>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-caption text-muted">
                {PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod] ?? order.paymentMethod}
              </span>
            </TableCell>
            <TableCell className="text-caption tabular-nums text-muted">
              {formatDate(order.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
