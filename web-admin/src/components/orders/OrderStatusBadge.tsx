import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { orderStatusLabels, type OrderStatus } from '@/lib/constants';

interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

/** Status → canonical Badge tone. Amber is reserved for manual overrides, so no status uses it. */
const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  pending: 'neutral',
  searching: 'searching',
  accepted: 'info',
  arriving: 'violet',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'muted-danger',
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const label = orderStatusLabels()[status as OrderStatus] ?? status;
  const variant = ORDER_STATUS_VARIANT[status as OrderStatus] ?? 'neutral';
  return (
    <Badge variant={variant} dot className={className}>
      {label}
    </Badge>
  );
}
