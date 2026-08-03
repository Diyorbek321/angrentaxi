'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { orderStatusMeta } from '@/lib/orderStatus';
import type { MarketOrderStatus } from '@/lib/api';

export interface OrderKanbanColumnProps {
  status: MarketOrderStatus;
  count: number;
  children: ReactNode;
}

/**
 * A column is purely visual grouping. There is no drag-and-drop: the backend
 * only advances an order one step at a time via `advanceOrder`, so dragging a
 * card between arbitrary columns would promise something the API cannot do.
 */
export function OrderKanbanColumn({ status, count, children }: OrderKanbanColumnProps) {
  const meta = orderStatusMeta(status);

  return (
    <section
      className="w-[290px] shrink-0 flex flex-col min-h-0 rounded-xl bg-surface-2/60 border border-line"
      aria-label={`${meta.label} — ${count} ta buyurtma`}
    >
      <header className="shrink-0 flex items-center gap-2 px-3 h-11 border-b border-line">
        <span className={cn('h-2 w-2 rounded-full shrink-0', meta.dot)} />
        <h2 className="text-[13px] font-semibold text-ink truncate">{meta.label}</h2>
        <span className="ml-auto min-w-[22px] h-5 px-1.5 rounded-full bg-surface border border-line text-[11px] font-mono font-semibold text-muted flex items-center justify-center tabular-nums">
          {count}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5">{children}</div>
    </section>
  );
}
