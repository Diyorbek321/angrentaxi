import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import type { MarketOrderStatus, ProductStatus } from '@/lib/api';

/**
 * Order lifecycle chips. The label always spells the state out, so the colour
 * reinforces the meaning instead of being the only thing that carries it —
 * several of these states are otherwise distinguishable by hue alone.
 */
const ORDER_META: Record<MarketOrderStatus, { label: string; variant: BadgeVariant }> = {
  new: { label: 'Yangi', variant: 'info' },
  packing: { label: "Yig'ilmoqda", variant: 'override' },
  shipped: { label: 'Yuborildi', variant: 'primary' },
  delivered: { label: 'Yetkazildi', variant: 'success' },
  cancelled: { label: 'Bekor qilindi', variant: 'danger' },
};

export function StatusBadge({ status, size }: { status: string; size?: 'sm' | 'md' }) {
  const meta = ORDER_META[status as MarketOrderStatus] ?? ORDER_META.new;
  return (
    <Badge variant={meta.variant} size={size} dot>
      {meta.label}
    </Badge>
  );
}

const PRODUCT_META: Record<ProductStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Faol', variant: 'success' },
  out: { label: 'Tugagan', variant: 'danger' },
  hidden: { label: 'Yashirilgan', variant: 'default' },
};

export function ProductStatusBadge({ status, size }: { status: ProductStatus; size?: 'sm' | 'md' }) {
  const meta = PRODUCT_META[status] ?? PRODUCT_META.hidden;
  return (
    <Badge variant={meta.variant} size={size} dot>
      {meta.label}
    </Badge>
  );
}
