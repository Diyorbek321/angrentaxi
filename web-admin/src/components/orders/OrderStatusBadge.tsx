import { cn } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, OrderStatus } from '@/lib/constants';

interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const label = ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
  const color = ORDER_STATUS_COLORS[status as OrderStatus] ?? 'bg-gray-100 text-gray-700';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        color,
        className
      )}
    >
      {label}
    </span>
  );
}
