'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, Eye } from 'lucide-react';
import { Order, PaginatedResponse } from '@/lib/api';
import { paymentMethodLabels } from '@/lib/constants';
import { OrderStatusBadge } from './OrderStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { serviceTypeLabel } from '@/lib/intercity';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import { PlateNumber } from '@/components/ui/PlateNumber';
import type { EmptyStateProps } from '@/components/ui/EmptyState';
import { formatDateTime, formatPhone, nameFallback, shortId } from '@/lib/format';
import { t } from '@/locales';

export const ORDERS_PAGE_SIZES = [20, 50, 100] as const;

interface OrdersTableProps {
  data: PaginatedResponse<Order>;
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
  /** Failure of the latest request; rows already on screen stay visible. */
  error?: string | null;
  onRetry?: () => void | Promise<void>;
  /** Shown in the empty state when filters are active. */
  hasFilters?: boolean;
  onClearFilters?: () => void;
  /** True when the only active filter is the "Bugun" date preset. */
  isTodayView?: boolean;
}

function OrderPrice({ order }: { order: Order }) {
  if (order.finalPrice != null) return <MoneyText value={order.finalPrice} className="font-medium text-ink" />;
  if (order.estimatedPrice > 0) return <MoneyText value={order.estimatedPrice} approx className="text-ink" />;
  return <span className="text-subtle">—</span>;
}

export function OrdersTable({
  data,
  currentPage,
  onPageChange,
  pageSize,
  onPageSizeChange,
  isLoading = false,
  error = null,
  onRetry,
  hasFilters = false,
  onClearFilters,
  isTodayView = false,
}: OrdersTableProps) {
  const m = t().orders.table;
  const router = useRouter();
  const open = (order: Order) => router.push(`/orders/${order.id}`);

  // Meaningful default sort: newest first, guaranteed client-side even if
  // the backend's ordering ever drifts.
  const rows = useMemo(
    () =>
      [...data.data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [data.data]
  );

  // First column is the human identifier (customer) — the mono order id
  // rides inside that cell as a sub-line, not as its own column.
  const columns: DataTableColumn<Order>[] = [
    {
      key: 'customer',
      header: m.customer,
      cell: (o) => (
        <div className="min-w-0">
          <p className="text-ink font-medium truncate">{o.passenger?.name || m.customer}</p>
          <p className="text-subtle text-xs whitespace-nowrap">
            <span className="font-mono">{shortId(o.id)}</span>
            <span className="num"> · {formatPhone(o.passenger?.phone)}</span>
          </p>
        </div>
      ),
    },
    {
      key: 'route',
      header: m.route,
      className: 'max-w-[260px]',
      hideBelow: 'md',
      cell: (o) => (
        <div className="min-w-0">
          {o.serviceType === 'intercity' && (
            <Badge size="sm" variant="info" className="mb-0.5">
              {serviceTypeLabel(o.serviceType)}
            </Badge>
          )}
          <p className="text-ink truncate">{o.pickupAddress ?? '—'}</p>
          <p className="text-muted truncate text-xs">→ {o.dropoffAddress ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: m.status,
      cell: (o) => <OrderStatusBadge status={o.status} size="sm" dot />,
    },
    {
      key: 'driver',
      header: m.driver,
      hideBelow: 'xl',
      cell: (o) =>
        o.driver ? (
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-ink truncate">{o.driver.name || nameFallback()}</span>
            <PlateNumber plate={o.driver.carNumber} className="shrink-0" />
          </div>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: 'payment',
      header: m.payment,
      hideBelow: '2xl',
      cell: (o) => <span className="text-muted whitespace-nowrap">{paymentMethodLabels()[o.paymentMethod]}</span>,
    },
    { key: 'price', header: m.price, numeric: true, cell: (o) => <OrderPrice order={o} /> },
    {
      key: 'createdAt',
      header: m.date,
      hideBelow: 'xl',
      className: 'num text-muted whitespace-nowrap',
      cell: (o) => formatDateTime(o.createdAt),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{m.actions}</span>,
      align: 'right',
      width: 'w-12',
      // Icon-only: a labelled "Koʻrish" button cost ~110px and clipped the
      // table at 1440. The whole row opens the order too; the button keeps
      // the keyboard/screen-reader path with the same accessible name.
      cell: (o) => (
        <Tooltip content={m.view} side="left">
          <IconButton
            size="sm"
            title=""
            aria-label={m.viewOrder}
            onClick={(e) => {
              e.stopPropagation();
              open(o);
            }}
          >
            <Eye aria-hidden />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  // Three different empties, not one generic void: filtered-to-empty offers
  // Clear filters; the today preset is a calm positive; first-use explains.
  const empty: EmptyStateProps = hasFilters
    ? {
        variant: 'no-results',
        title: m.emptyFilteredTitle,
        description: m.emptyFilteredHint,
        onClearFilters,
      }
    : isTodayView
    ? {
        variant: 'cleared',
        icon: <CalendarCheck aria-hidden />,
        title: m.emptyTodayTitle,
        description: m.emptyTodayHint,
        action: onClearFilters ? (
          <Button variant="secondary" size="sm" onClick={onClearFilters}>
            {m.showAllHistory}
          </Button>
        ) : undefined,
      }
    : {
        variant: 'first-use',
        title: m.emptyTitle,
        description: m.emptyHint,
      };

  return (
    <DataTable
      ariaLabel={t().orders.list.title}
      columns={columns}
      rows={rows}
      rowKey={(o) => o.id}
      loading={isLoading}
      error={error}
      onRetry={onRetry}
      empty={empty}
      onRowClick={open}
      maxHeightClassName="max-h-[calc(100vh-260px)]"
      pagination={{
        page: currentPage,
        totalPages: Math.max(1, data.totalPages),
        total: data.total,
        pageSize,
        onPageChange,
        onPageSizeChange,
        pageSizeOptions: ORDERS_PAGE_SIZES,
      }}
    />
  );
}
