'use client';

import Link from 'next/link';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { formatMoney, formatRelative, shortId } from '@/lib/format';
import type { DashboardData } from '@/lib/api';

export function RecentOrders({ orders }: { orders: DashboardData['recentOrders'] }) {
  return (
    <Card>
      <CardHeader
        title="So'nggi buyurtmalar"
        icon={<ClipboardList size={16} />}
        action={
          <Link
            href="/dashboard/orders"
            className="text-xs font-medium text-primary-700 dark:text-primary-300 hover:underline inline-flex items-center gap-1"
          >
            Barchasi <ArrowRight size={12} />
          </Link>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          compact
          title="Hali buyurtma yo'q"
          description="Yangi buyurtmalar shu yerda ko'rinadi."
        />
      ) : (
        <ul className="divide-y divide-line -mx-1">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center gap-3 px-1 py-2.5">
              <span className="font-mono text-xs text-muted shrink-0 w-16">
                {shortId(order.id)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{order.customer}</p>
                <p className="text-2xs text-subtle mt-0.5">
                  {order.itemsCount} dona · {formatRelative(order.createdAt)}
                </p>
              </div>
              <span className="font-mono text-sm font-semibold text-ink tabular-nums shrink-0">
                {formatMoney(order.totalPrice)}
              </span>
              <StatusBadge status={order.status} size="sm" className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
