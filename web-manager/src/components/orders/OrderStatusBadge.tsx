import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { OrderStatus, ORDER_STATUS_LABELS } from '@/lib/constants';

// Mint shades track the automatic flow (arrived -> in progress -> completed);
// amber marks `searching`, the one state a dispatcher may have to act on.
const statusVariantMap: Record<OrderStatus, BadgeVariant> = {
  created: 'default',
  searching: 'warning',
  accepted: 'info',
  arrived: 'mint-soft',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'danger',
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function OrderStatusBadge({ status, size = 'md', dot = false }: OrderStatusBadgeProps) {
  return (
    <Badge variant={statusVariantMap[status]} size={size} dot={dot}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
