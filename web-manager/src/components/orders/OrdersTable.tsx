'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Eye, Inbox } from 'lucide-react';
import { Order, PaginatedResponse } from '@/lib/api';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { OrderStatusBadge } from './OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatDateTime, formatMoney, formatMoneyApprox, formatPhone, shortId } from '@/lib/format';

interface OrdersTableProps {
  data: PaginatedResponse<Order>;
  currentPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  /** Shown in the empty state when filters are active. */
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

const HEADERS = [
  'Buyurtma',
  'Mijoz',
  'Olib ketish',
  'Tashlab ketish',
  'Status',
  'Haydovchi',
  'Toʻlov',
  'Narx',
  'Sana',
  '',
];

export function OrdersTable({
  data,
  currentPage,
  onPageChange,
  isLoading = false,
  hasFilters = false,
  onClearFilters,
}: OrdersTableProps) {
  const router = useRouter();

  if (isLoading) {
    return <SkeletonTable rows={8} cols={6} />;
  }

  if (data.data.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={22} />}
        title={hasFilters ? 'Filtrga mos buyurtma topilmadi' : 'Buyurtmalar yoʻq'}
        description={
          hasFilters
            ? 'Qidiruv soʻzini yoki status filtrini oʻzgartirib koʻring.'
            : 'Yangi buyurtmalar shu roʻyxatda paydo boʻladi.'
        }
        action={
          hasFilters && onClearFilters ? (
            <Button variant="secondary" size="sm" onClick={onClearFilters}>
              Filtrlarni tozalash
            </Button>
          ) : undefined
        }
      />
    );
  }

  const from = (currentPage - 1) * data.limit + 1;
  const to = Math.min(currentPage * data.limit, data.total);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm text-left">
          <thead className="bg-surface-2 text-subtle uppercase text-[10px] tracking-wider">
            <tr>
              {HEADERS.map((h, i) => (
                <th key={i} className="px-4 py-3 font-semibold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.data.map((order) => (
              <tr
                key={order.id}
                onClick={() => router.push(`/orders/${order.id}`)}
                className="hover:bg-surface-2/70 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 font-mono text-xs font-semibold text-muted whitespace-nowrap">
                  {shortId(order.id)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={order.passenger?.name} size="xs" tone="muted" />
                    <div className="min-w-0">
                      <p className="text-ink font-medium truncate">
                        {order.passenger?.name ?? '—'}
                      </p>
                      <p className="text-subtle text-[11px] font-mono">
                        {formatPhone(order.passenger?.phone)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 max-w-[170px]">
                  <p className="text-muted truncate text-xs">{order.pickupAddress ?? '—'}</p>
                </td>
                <td className="px-4 py-3 max-w-[170px]">
                  <p className="text-muted truncate text-xs">{order.dropoffAddress ?? '—'}</p>
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
                <td className="px-4 py-3 text-ink text-xs font-mono font-medium whitespace-nowrap">
                  {order.finalPrice != null
                    ? formatMoney(order.finalPrice)
                    : order.estimatedPrice > 0
                    ? formatMoneyApprox(order.estimatedPrice)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
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

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p className="text-xs">
          <span className="font-mono">
            {from}–{to}
          </span>{' '}
          / jami <span className="font-mono">{data.total}</span> buyurtma
        </p>
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
          <span className="px-3 py-1.5 text-xs font-mono bg-surface-2 border border-line rounded-lg text-muted">
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
