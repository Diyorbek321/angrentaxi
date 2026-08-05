import { Badge } from '@/components/ui/Badge';
import { statusMeta } from '@/lib/order-status';

export interface OrderStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  /** Uzun ko'rinish — yozuv yoniga izohni ham qo'shadi. */
  withHint?: boolean;
}

/**
 * Holat uch kanal bilan beriladi: rang + ikonka + yozuv. Rangni ko'rmaydigan
 * foydalanuvchi ham holatni ikonka va matndan tushunadi (WCAG 1.4.1).
 */
export function OrderStatusBadge({ status, size = 'md', withHint = false }: OrderStatusBadgeProps) {
  const meta = statusMeta(status);
  const iconSize = size === 'lg' ? 16 : 13;

  return (
    <Badge variant={meta.variant} size={size} icon={<meta.Icon size={iconSize} />}>
      {meta.label}
      {withHint && <span className="font-medium opacity-80">· {meta.hint}</span>}
    </Badge>
  );
}
