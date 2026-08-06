'use client';

import { ArrowDownRight, ArrowUpRight, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime, UNIT_LABEL } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import type { StockMovement } from '@/lib/api';

export function StockMovements({ movements }: { movements: StockMovement[] }) {
  return (
    <Card>
      <CardHeader
        title="O'zgarishlar tarixi"
        subtitle="Zaxira qachon va qancha o'zgargani"
        icon={<History size={16} />}
      />

      {movements.length === 0 ? (
        <EmptyState
          compact
          title="Hali o'zgarish yo'q"
          description="Zaxirani to'ldirganingizda yozuv shu yerda paydo bo'ladi."
        />
      ) : (
        <ul className="divide-y divide-line -mx-1 max-h-[28rem] overflow-y-auto">
          {movements.map((movement) => {
            const up = movement.delta > 0;
            return (
              <li key={movement.id} className="flex items-center gap-3 px-1 py-2.5">
                <span
                  className={cn(
                    'h-8 w-8 shrink-0 rounded-lg flex items-center justify-center',
                    up
                      ? 'bg-primary/12 text-primary-600 dark:text-primary-300'
                      : 'bg-danger/12 text-danger'
                  )}
                  aria-hidden
                >
                  {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">
                    <span aria-hidden>{movement.product.emoji} </span>
                    {movement.product.name}
                  </p>
                  <p className="text-2xs text-subtle mt-0.5 truncate">
                    {movement.note ? `${movement.note} · ` : ''}
                    {formatDateTime(movement.createdAt)}
                  </p>
                </div>

                <span
                  className={cn(
                    'shrink-0 font-mono text-sm font-bold tabular-nums',
                    up ? 'text-primary-700 dark:text-primary-300' : 'text-danger'
                  )}
                >
                  {up ? '+' : ''}
                  {movement.delta}
                  <span className="text-2xs text-subtle font-sans ml-1">
                    {UNIT_LABEL[movement.product.unit]}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
