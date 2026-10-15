import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { OrderStatus, ORDER_STATUS_LABELS } from '@/lib/constants';

// One lifecycle, one ramp (see ORDER_STATUS_ACCENT in lib/constants.ts):
// neutral -> searching (animated mint tint — the machine working) -> info
// (driver assigned / arrived) -> success (on trip / done) -> danger tint
// (cancelled). Amber appears nowhere in the lifecycle: it is reserved for the
// manual-override flow alone.
const statusVariantMap: Record<OrderStatus, BadgeVariant> = {
  created: 'neutral',
  searching: 'searching',
  accepted: 'info',
  arrived: 'info',
  in_progress: 'success',
  completed: 'success',
  cancelled: 'muted-danger',
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
