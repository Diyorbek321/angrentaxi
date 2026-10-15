// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/** Shimmer block. Accepts any div attribute. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton rounded-ds-xs', className)} {...props} />;
}

function Frame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">Yuklanmoqda…</span>
      {children}
    </div>
  );
}

export interface SkeletonCardsProps {
  count?: number;
  /** Tailwind height class of one card. */
  height?: string;
  /** Grid layout (2/3 columns) instead of a vertical stack. */
  columns?: boolean;
  className?: string;
}

/** Placeholder stack for card lists. */
export function SkeletonCards({ count = 3, height = 'h-32', columns = false, className }: SkeletonCardsProps) {
  return (
    <Frame
      className={cn(
        columns ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-3',
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn(height, 'rounded-ds-md')} />
      ))}
    </Frame>
  );
}

export interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  /** Row height follows DataTable density. */
  compact?: boolean;
  className?: string;
}

/** Mirrors DataTable: 40px header, 40px (32px compact) rows, hairline dividers. */
export function SkeletonTable({ rows = 6, cols = 5, compact = false, className }: SkeletonTableProps) {
  const widths = ['w-2/3', 'w-1/2', 'w-3/4', 'w-1/3', 'w-2/5'];
  return (
    <Frame className={cn('overflow-hidden rounded-ds-md border border-line bg-surface', className)}>
      <div className="h-10 px-4 flex items-center gap-4 border-b border-line bg-surface-2/50">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1">
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        ))}
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className={cn('px-4 flex items-center gap-4', compact ? 'h-8' : 'h-10')}>
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="flex-1">
                <Skeleton className={cn('h-3', widths[(r + c) % widths.length])} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Mirrors the StatCard row (label / value / hint). */
export function SkeletonStats({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <Frame className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-ds-md border border-line bg-surface p-4 space-y-3">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      ))}
    </Frame>
  );
}

/** Label + 32px field pairs. */
export function SkeletonForm({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <Frame className={cn('space-y-4', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-full rounded-ds-sm" />
        </div>
      ))}
    </Frame>
  );
}

/** Paragraph lines. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Frame className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </Frame>
  );
}
