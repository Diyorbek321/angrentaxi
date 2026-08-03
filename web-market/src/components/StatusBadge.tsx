import type { MarketOrderStatus } from '@/lib/api';
import { orderStatusMeta } from '@/lib/orderStatus';
import { cn } from '@/lib/utils';

/**
 * Order status chip. Labels and colours come from lib/orderStatus.ts — this
 * component only renders them, so a translation is never re-typed at a call
 * site.
 */
export function StatusBadge({
  status,
  size = 'md',
  dot = false,
  className,
}: {
  status: MarketOrderStatus | string;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}) {
  const meta = orderStatusMeta(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap',
        meta.chip,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', meta.dot)} />}
      {meta.label}
    </span>
  );
}
