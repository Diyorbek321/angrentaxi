import { clsx } from 'clsx';

/**
 * Yuklanish holati spinner bilan emas, kontent shakliga mos skelet bilan
 * ko'rsatiladi — shunda yuklangach hech narsa "sakramaydi".
 * `.skeleton` shimmer'i globals.css da, `prefers-reduced-motion` da o'chadi.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton rounded-ds-xs', className)} aria-hidden />;
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** KPI plitkalari qatori. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <Frame label="Ko'rsatkichlar yuklanmoqda">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-ds-md" />
        ))}
      </div>
    </Frame>
  );
}

/** Karta ro'yxatlari (buyurtmalar, taomlar). */
export function SkeletonCards({
  count = 3,
  height = 'h-40',
  columns,
  className,
}: {
  count?: number;
  height?: string;
  columns?: boolean;
  className?: string;
}) {
  return (
    <Frame label="Ma'lumot yuklanmoqda">
      <div
        className={clsx(
          columns ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-3',
          className
        )}
      >
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className={clsx(height, 'rounded-ds-md')} />
        ))}
      </div>
    </Frame>
  );
}

/** Jadval tuzilishiga mos qatorlar. */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Frame label="Jadval yuklanmoqda">
      <div className="overflow-hidden rounded-ds-md border border-line">
        <div className="bg-surface-2 px-4 py-3 flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        <div className="divide-y divide-line bg-surface">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="px-4 py-4 flex gap-4">
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton key={c} className="h-3.5 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Forma maydonlari (sozlamalar sahifasi). */
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <Frame label="Forma yuklanmoqda">
      <div className="flex flex-col gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-full rounded-ds-sm" />
          </div>
        ))}
      </div>
    </Frame>
  );
}
