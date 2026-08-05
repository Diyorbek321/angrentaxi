import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden />;
}

/** Placeholder stack for card lists (orders, products). */
export function SkeletonCards({
  count = 3,
  height = 'h-32',
  className,
}: {
  count?: number;
  height?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn(height, 'rounded-xl')} />
      ))}
    </div>
  );
}

/** Placeholder grid, matching the product card grid. */
export function SkeletonGrid({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3', className)}
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

/** Placeholder rows matching the table layout, so nothing jumps on load. */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line" aria-busy="true">
      <div className="bg-surface-2 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-line bg-surface">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3.5 flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder for the KPI tile row. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}
