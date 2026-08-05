'use client';

import { TrendingUp } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DashboardData } from '@/lib/api';

export function BestSellers({ items }: { items: DashboardData['bestSellers'] }) {
  // Bars are scaled against the leader, not the grand total — the ranking is
  // what the vendor reads here, not each item's share of revenue.
  const max = items[0]?.sold || 1;

  return (
    <Card>
      <CardHeader title="Eng ko'p sotilgan" icon={<TrendingUp size={16} />} />

      {items.length === 0 ? (
        <EmptyState
          compact
          title="Hali ma'lumot yo'q"
          description="Birinchi buyurtmalardan keyin bu ro'yxat to'ladi."
        />
      ) : (
        <ol className="space-y-3">
          {items.map((item, i) => (
            <li key={item.name} className="flex items-center gap-3">
              <span className="h-6 w-6 shrink-0 rounded-lg bg-primary/12 text-primary-700 dark:text-primary-300 text-2xs font-bold font-mono flex items-center justify-center">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                <div className="h-1.5 rounded-full bg-surface-2 mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((item.sold / max) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 font-mono text-xs font-semibold text-muted tabular-nums">
                {item.sold}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
