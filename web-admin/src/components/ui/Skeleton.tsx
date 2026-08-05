import { cn } from '@/lib/utils';

/**
 * Yuklanish holati spinner emas, SKELETON bilan ko'rsatiladi — natijaviy
 * tartibga mos shakl chizilsa, ma'lumot kelganda hech narsa sakramaydi.
 * `.skeleton` utility'si globals.css da (shimmer + surface-2 foni).
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton rounded-ds-xs', className)} aria-hidden="true" {...props} />;
}

/** Karta ro'yxatlari uchun (buyurtma, haydovchi, so'rov). */
function SkeletonCards({
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
        <Skeleton key={i} className={cn(height, 'rounded-ds-md')} />
      ))}
    </div>
  );
}

/** Jadval tartibiga mos qatorlar. */
function SkeletonTable({
  rows = 6,
  cols = 5,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('overflow-hidden rounded-ds-md border border-line', className)}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex gap-4 bg-surface-2 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-divider bg-surface">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** KPI kartalari qatori. */
function SkeletonStats({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[112px] rounded-ds-md" />
      ))}
    </div>
  );
}

/** Forma maydonlari (sozlamalar, tarif tahriri). */
function SkeletonForm({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-full rounded-ds-md" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCards, SkeletonTable, SkeletonStats, SkeletonForm };
