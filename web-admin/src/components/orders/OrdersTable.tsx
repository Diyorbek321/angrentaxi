'use client';

import { useRouter } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { DataTable, type DataTableColumn, type SortState } from '@/components/ui/DataTable';
import type { PaginationProps } from '@/components/ui/Pagination';
import { MoneyText } from '@/components/ui/MoneyText';
import { PlateNumber } from '@/components/ui/PlateNumber';
import { OrderStatusBadge } from './OrderStatusBadge';
import type { Order } from '@/lib/api';
import { formatDateTime, formatPhone, fullName, shortId } from '@/lib/format';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/constants';

export function orderPrice(order: Order): number {
  return order.finalPrice ?? order.estimatedPrice;
}

const COLUMNS: DataTableColumn<Order>[] = [
  {
    key: 'id',
    header: 'ID',
    sortable: true,
    width: 'w-24',
    cell: (o) => <span className="font-mono text-xs text-muted whitespace-nowrap">{shortId(o.id)}</span>,
  },
  {
    key: 'passenger',
    header: 'Yoʻlovchi',
    cell: (o) => (
      <div className="min-w-0 leading-tight">
        <p className="font-medium text-ink truncate">{fullName(o.passenger.firstName, o.passenger.lastName)}</p>
        <p className="num text-xs text-muted whitespace-nowrap">{formatPhone(o.passenger.phone)}</p>
      </div>
    ),
  },
  {
    key: 'driver',
    header: 'Haydovchi',
    hideBelow: 'md',
    cell: (o) =>
      o.driver ? (
        <div className="min-w-0 leading-tight">
          <p className="font-medium text-ink truncate">{fullName(o.driver.firstName, o.driver.lastName)}</p>
          {o.driver.carNumber && <PlateNumber plate={o.driver.carNumber} className="mt-0.5" />}
        </div>
      ) : (
        <span className="text-subtle">—</span>
      ),
  },
  {
    key: 'route',
    header: 'Manzil',
    hideBelow: 'xl',
    className: 'max-w-[240px]',
    cell: (o) => (
      <div className="min-w-0 leading-tight">
        <p className="truncate text-ink">{o.pickupAddress ?? '—'}</p>
        <p className="truncate text-xs text-muted">{o.dropoffAddress ?? '—'}</p>
      </div>
    ),
  },
  { key: 'status', header: 'Holat', sortable: true, cell: (o) => <OrderStatusBadge status={o.status} /> },
  {
    key: 'price',
    header: 'Narx',
    numeric: true,
    sortable: true,
    cell: (o) => <MoneyText value={orderPrice(o)} className="font-medium" />,
  },
  {
    key: 'payment',
    header: 'Toʻlov',
    hideBelow: 'xl',
    cell: (o) => (
      <span className="text-muted whitespace-nowrap">
        {PAYMENT_METHOD_LABELS[o.paymentMethod as PaymentMethod] ?? o.paymentMethod}
      </span>
    ),
  },
  {
    key: 'createdAt',
    header: 'Sana',
    sortable: true,
    cell: (o) => <span className="num text-muted whitespace-nowrap">{formatDateTime(o.createdAt)}</span>,
  },
];

interface OrdersTableProps {
  orders: Order[];
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  /** Whether filters caused the empty result — picks the right empty state. */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  pagination?: PaginationProps;
  toolbar?: React.ReactNode;
}

export function OrdersTable({
  orders,
  isLoading,
  error,
  onRetry,
  sort,
  onSortChange,
  hasActiveFilters = false,
  onClearFilters,
  pagination,
  toolbar,
}: OrdersTableProps) {
  const router = useRouter();
  return (
    <DataTable
      ariaLabel="Buyurtmalar"
      columns={COLUMNS}
      rows={orders}
      rowKey={(o) => o.id}
      loading={isLoading}
      error={error}
      onRetry={onRetry}
      sort={sort}
      onSortChange={onSortChange}
      onRowClick={(o) => router.push(`/dashboard/orders/${o.id}`)}
      maxHeightClassName="max-h-[calc(100vh-260px)]"
      pagination={pagination}
      toolbar={toolbar}
      isFiltered={hasActiveFilters}
      onClearFilters={onClearFilters}
      emptyFiltered={{ title: 'Hech narsa mos kelmadi', description: 'Tanlangan filtrlar boʻyicha buyurtma topilmadi.' }}
      empty={{
        variant: 'first-use',
        icon: <ClipboardList aria-hidden />,
        title: 'Hozircha buyurtmalar yoʻq',
        description: 'Yoʻlovchilar buyurtma berishi bilan ular shu jadvalda paydo boʻladi.',
      }}
    />
  );
}
