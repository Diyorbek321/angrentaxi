import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { OrderStatus, ORDER_STATUS_LABELS } from '@/lib/constants';

const statusVariantMap: Record<OrderStatus, BadgeVariant> = {
  created: 'default',
  searching: 'info',
  accepted: 'success',
  arrived: 'warning',
  in_progress: 'orange',
  completed: 'success',
  cancelled: 'danger',
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
}

export function OrderStatusBadge({ status, size = 'md' }: OrderStatusBadgeProps) {
  return (
    <Badge variant={statusVariantMap[status]} size={size}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
