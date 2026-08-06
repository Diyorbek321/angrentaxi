'use client';

import { formatMoney } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ReportsData } from '@/lib/api';

/**
 * Category share as horizontal bars rather than a donut. The categories are
 * nominal, so every bar gets the same hue — length carries the magnitude and
 * the name sits next to it as text. A donut with six near-equal slices is
 * exactly the comparison a pie is worst at.
 */
export function CategoryBars({ data }: { data: ReportsData['categoryBreakdown'] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        compact
        title="Hali ma'lumot yo'q"
        description="Buyurtmalar tushgach taqsimot shu yerda ko'rinadi."
      />
    );
  }

  const sorted = [...data].sort((a, b) => b.total - a.total);
  const max = Math.max(...sorted.map((c) => c.total), 1);

  return (
    <ul className="space-y-3">
      {sorted.map((category) => (
        <li key={category.name}>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-sm text-ink truncate">{category.name}</span>
            <span className="shrink-0 text-xs text-muted font-mono tabular-nums">
              {formatMoney(category.total)}
              <span className="text-subtle ml-2">{category.pct}%</span>
            </span>
          </div>
          {/* Square at the baseline, 4px rounded at the data end. */}
          <div className="h-2.5 rounded-sm bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-primary rounded-r"
              style={{ width: `${Math.max(2, Math.round((category.total / max) * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
