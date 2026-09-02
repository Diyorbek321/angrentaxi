import { Badge } from '@/components/ui/Badge';
import type { ProductStatus } from '@/lib/api';
import { orderStatusMeta } from '@/lib/order-status';
import { productStatusMeta } from '@/lib/product-status';

/**
 * Holat chiplari. Yozuv, ikonka va rang UCHALASI markazlashgan lug'atdan
 * keladi (`lib/order-status.ts`, `lib/product-status.ts`) — sahifalar holat
 * matnini o'zi yozmaydi, rang esa ma'noni yolg'iz tashimaydi (WCAG 1.4.1).
 */
export function StatusBadge({ status, size }: { status: string; size?: 'sm' | 'md' }) {
  const meta = orderStatusMeta(status);
  const Icon = meta.Icon;
  return (
    <Badge variant={meta.variant} size={size}>
      <Icon size={size === 'sm' ? 11 : 12} aria-hidden className="shrink-0" />
      {meta.label}
    </Badge>
  );
}

export function ProductStatusBadge({
  status,
  size,
}: {
  status: ProductStatus;
  size?: 'sm' | 'md';
}) {
  const meta = productStatusMeta(status);
  const Icon = meta.Icon;
  return (
    <Badge variant={meta.variant} size={size}>
      <Icon size={size === 'sm' ? 11 : 12} aria-hidden className="shrink-0" />
      {meta.label}
    </Badge>
  );
}
