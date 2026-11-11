import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { OrderStatus, orderStatusLabels } from '@/lib/constants';
import type { DeliveryState } from '@/lib/delivery-incident';
import { t } from '@/locales';

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
  /**
   * Yetkazish hodisasi (lib/delivery-incident.ts `deliveryState`). Status enum
   * o'zgarmagan, shuning uchun "Qaytarilmoqda"/"Qaytarildi" shu yerda ustidan yoziladi.
   */
  delivery?: DeliveryState | null;
}

export function OrderStatusBadge({ status, size = 'md', dot = false, delivery = null }: OrderStatusBadgeProps) {
  if (delivery) {
    const di = t().lib.deliveryIncident;
    return (
      // Qaytarilmoqda — hal qilinmagan hodisa (qizil); qaytarildi — yakuniy salbiy holat.
      <Badge variant={delivery === 'returning' ? 'danger' : 'muted-danger'} size={size} dot={dot}>
        {delivery === 'returning' ? di.returning : di.returned}
      </Badge>
    );
  }
  return (
    <Badge variant={statusVariantMap[status]} size={size} dot={dot}>
      {orderStatusLabels()[status]}
    </Badge>
  );
}
