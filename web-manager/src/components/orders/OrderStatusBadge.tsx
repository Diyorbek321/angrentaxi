import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { OrderStatus, ORDER_STATUS_LABELS } from '@/lib/constants';

// One lifecycle, one ramp (see ORDER_STATUS_ACCENT in lib/constants.ts):
// neutral -> searching (animated mint tint — the machine working) -> info ->
// mint light -> mint -> deep green -> red. Amber appears nowhere in the
// lifecycle: it is reserved for the manual-override flow alone.
const statusVariantMap: Record<OrderStatus, BadgeVariant> = {
  created: 'default',
  searching: 'searching',
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
