'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, ChevronLeft, ChevronRight, Eye, Inbox } from 'lucide-react';
import { Order, PaginatedResponse } from '@/lib/api';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { OrderStatusBadge } from './OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatDateTime, formatMoney, formatMoneyApprox, formatPhone, shortId } from '@/lib/format';

export const ORDERS_PAGE_SIZES = [20, 50, 100] as const;

interface OrdersTableProps {
  data: PaginatedResponse<Order>;
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
  /** Shown in the empty state when filters are active. */
  hasFilters?: boolean;
  onClearFilters?: () => void;
  /** True when the only active filter is the "Bugun" date preset. */
  isTodayView?: boolean;
}

// First column is the human identifier (customer), per data-tables.md — the
// mono order id rides inside that cell as a sub-line, not as its own column.
const HEADERS: { label: string; align?: 'right' }[] = [
  { label: 'Mijoz' },
  { label: 'Marshrut' },
  { label: 'Status' },
  { label: 'Haydovchi' },
  { label: 'Toʻlov' },
  { label: 'Narx', align: 'right' },
  { label: 'Sana' },
  { label: '' },
];

export function OrdersTable({
  data,
  currentPage,
  onPageChange,
  pageSize,
  onPageSizeChange,
  isLoading = false,
  hasFilters = false,
  onClearFilters,
  isTodayView = false,
}: OrdersTableProps) {
  const router = useRouter();

  // Meaningful default sort: newest first, guaranteed client-side even if
  // the backend's ordering ever drifts — the table must be useful before any
  // interaction.
  const rows = useMemo(
    () =>
      [...data.data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [data.data]
  );

  if (isLoading && rows.length === 0) {
    // Skeleton mirrors the real table: same column count, ghost rows.
    return <SkeletonTable rows={8} cols={HEADERS.length - 1} />;
  }

  if (rows.length === 0) {
    // Three different empties, not one generic void (data-tables.md):
    // filtered-to-empty offers Clear filters right here; the today preset
    // empty is a calm positive; true first-use explains what will appear.
    if (hasFilters) {
      return (
        <EmptyState
          icon={<Inbox size={22} />}
          title="Filtrga mos buyurtma topilmadi"
          description="Qidiruv soʻzini, statusni yoki sana oraligʻini oʻzgartirib koʻring."
          action={
            onClearFilters ? (
              <Button variant="secondary" size="sm" onClick={onClearFilters}>
                Filtrlarni tozalash
              </Button>
            ) : undefined
          }
        />
      );
    }
    if (isTodayView) {
      return (
        <EmptyState
          tone="positive"
          icon={<CalendarCheck size={22} />}
          title="Bugun hali buyurtma yoʻq"
          description="Birinchi buyurtma kelishi bilan shu jadvalda koʻrinadi."
          action={
            onClearFilters ? (
              <Button variant="secondary" size="sm" onClick={onClearFilters}>
                Butun tarixni koʻrish
              </Button>
            ) : undefined
          }
        />
      );
    }
    return (
      <EmptyState
        icon={<Inbox size={22} />}
        title="Buyurtmalar yoʻq"
        description="Yangi buyurtmalar shu roʻyxatda paydo boʻladi."
      />
    );
  }

  const from = (currentPage - 1) * data.limit + 1;
  const to = Math.min(currentPage * data.limit, data.total);

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* The table owns its scroll region so the header can actually freeze —
          sticky inside a page-level scroller never sticks. */}
      <div className="flex-1 min-h-0 overflow-auto rounded-ds-sm border border-line bg-surface">
        <table className="w-full text-sm text-left">
          <thead className="text-subtle uppercase text-[10px] tracking-wider">
            <tr>
              {HEADERS.map((h, i) => (
                <th
                  key={i}
                  className={`sticky-th bg-surface-2 px-4 py-3 font-semibold whitespace-nowrap ${
                    h.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((order) => (
              <tr
                key={order.id}
                onClick={() => router.push(`/orders/${order.id}`)}
                className="hover:bg-surface-2/70 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={order.passenger?.name} size="xs" tone="muted" />
                    <div className="min-w-0">
                      <p className="text-ink font-medium truncate">
                        {order.passenger?.name ?? 'Mijoz'}
                      </p>
                      <p className="text-subtle text-[11px] font-mono whitespace-nowrap">
                        {shortId(order.id)} · {formatPhone(order.passenger?.phone)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 max-w-[240px]">
                  <p className="text-ink truncate text-xs">{order.pickupAddress ?? '—'}</p>
                  <p className="text-muted truncate text-xs mt-0.5">
                    → {order.dropoffAddress ?? '—'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} size="sm" dot />
                </td>
                <td className="px-4 py-3">
                  {order.driver ? (
                    <div className="min-w-0">
                      <p className="text-ink text-xs font-medium truncate">{order.driver.name}</p>
                      <p className="text-subtle text-[11px] font-mono">{order.driver.carNumber}</p>
                    </div>
                  ) : (
                    <span className="text-subtle text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                </td>
                {/* Numbers: right-aligned, mono/tabular — column scanning. */}
                <td className="px-4 py-3 text-ink text-xs font-mono font-medium whitespace-nowrap text-right tabular-nums">
                  {order.finalPrice != null
                    ? formatMoney(order.finalPrice)
                    : order.estimatedPrice > 0
                    ? formatMoneyApprox(order.estimatedPrice)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-muted text-xs whitespace-nowrap tabular-nums">
                  {formatDateTime(order.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/orders/${order.id}`);
                    }}
                    leftIcon={<Eye size={14} />}
                    aria-label="Buyurtmani koʻrish"
                  >
                    <span className="hidden lg:inline">Koʻrish</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted shrink-0">
        <div className="flex items-center gap-3">
          <p className="text-xs">
            <span className="font-mono tabular-nums">
              {from}–{to}
            </span>{' '}
            / jami <span className="font-mono tabular-nums">{data.total}</span> buyurtma
          </p>
          <label className="flex items-center gap-1.5 text-xs">
            <span className="text-subtle">Sahifada:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Sahifadagi qatorlar soni"
              className="h-7 rounded-ds-xs border border-line bg-surface px-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-focus/40"
            >
              {ORDERS_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            leftIcon={<ChevronLeft size={14} />}
          >
            Oldingi
          </Button>
          <span className="px-3 py-1.5 text-xs font-mono tabular-nums bg-surface-2 border border-line rounded-ds-xs text-muted">
            {currentPage} / {Math.max(1, data.totalPages)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= data.totalPages}
            rightIcon={<ChevronRight size={14} />}
          >
            Keyingi
          </Button>
        </div>
      </div>
    </div>
  );
}
