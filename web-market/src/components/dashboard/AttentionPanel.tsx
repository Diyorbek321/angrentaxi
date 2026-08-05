'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, PackageX } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMoney, formatStock, shortId } from '@/lib/format';
import type { MarketOrder, Product } from '@/lib/api';
import type { DashboardData } from '@/lib/api';

export interface AttentionPanelProps {
  /** Products the vendor can no longer sell. */
  outOfStock: Product[];
  /** Products about to run out — from the dashboard payload. */
  lowStock: DashboardData['lowStock'];
  /** Orders nobody has started packing yet. */
  newOrders: MarketOrder[];
}

/**
 * The "what needs me right now" panel. When there is nothing to fix it must
 * read as reassurance, not as an empty table — an idle vendor should be able
 * to glance at this and walk away.
 */
export function AttentionPanel({ outOfStock, lowStock, newOrders }: AttentionPanelProps) {
  const nothingToDo =
    outOfStock.length === 0 && lowStock.length === 0 && newOrders.length === 0;

  return (
    <Card>
      <CardHeader
        title="Diqqat talab qiladi"
        subtitle={nothingToDo ? undefined : 'Quyidagilar kutib turibdi'}
        icon={<AlertTriangle size={16} />}
      />

      {nothingToDo ? (
        <EmptyState
          compact
          tone="positive"
          icon={<CheckCircle2 size={20} />}
          title="Hammasi joyida"
          description="Javobsiz buyurtma yo'q, zaxira ham yetarli."
        />
      ) : (
        <div className="space-y-4">
          {newOrders.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Bell size={13} className="text-primary" />
                  Javobsiz buyurtmalar
                  <span className="font-mono text-muted">({newOrders.length})</span>
                </h3>
                <Link
                  href="/dashboard/orders"
                  className="text-xs font-medium text-primary-700 dark:text-primary-300 hover:underline inline-flex items-center gap-1"
                >
                  Ko&apos;rish <ArrowRight size={12} />
                </Link>
              </div>
              <ul className="rounded-lg border border-primary/25 bg-primary/[0.06] divide-y divide-primary/15">
                {newOrders.slice(0, 4).map((order) => (
                  <li
                    key={order.id}
                    className="px-3 py-2 flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="font-mono text-xs text-muted shrink-0">
                      {shortId(order.id)}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-ink">
                      {order.deliveryAddress}
                    </span>
                    <span className="font-mono text-xs font-semibold text-ink tabular-nums shrink-0">
                      {formatMoney(order.totalPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {outOfStock.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <PackageX size={13} className="text-danger" />
                  Zaxira tugagan
                  <span className="font-mono text-muted">({outOfStock.length})</span>
                </h3>
                <Link
                  href="/dashboard/stock"
                  className="text-xs font-medium text-primary-700 dark:text-primary-300 hover:underline inline-flex items-center gap-1"
                >
                  To&apos;ldirish <ArrowRight size={12} />
                </Link>
              </div>
              <ul className="rounded-lg border border-danger/25 bg-danger/[0.06] divide-y divide-danger/15">
                {outOfStock.slice(0, 4).map((product) => (
                  <li
                    key={product.id}
                    className="px-3 py-2 flex items-center gap-2.5 text-sm text-ink"
                  >
                    <span aria-hidden>{product.emoji}</span>
                    <span className="flex-1 min-w-0 truncate">{product.name}</span>
                    <span className="text-xs font-semibold text-danger shrink-0">0</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lowStock.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <AlertTriangle size={13} className="text-warn-dark dark:text-warn-light" />
                  Zaxira kam
                  <span className="font-mono text-muted">({lowStock.length})</span>
                </h3>
                <Link
                  href="/dashboard/stock"
                  className="text-xs font-medium text-primary-700 dark:text-primary-300 hover:underline inline-flex items-center gap-1"
                >
                  Ko&apos;rish <ArrowRight size={12} />
                </Link>
              </div>
              <ul className="rounded-lg border border-warn/25 bg-warn/[0.06] divide-y divide-warn/15">
                {lowStock.slice(0, 4).map((product) => (
                  <li
                    key={product.id}
                    className="px-3 py-2 flex items-center justify-between gap-3 text-sm text-ink"
                  >
                    <span className="flex-1 min-w-0 truncate">{product.name}</span>
                    <span className="font-mono text-xs font-semibold text-warn-dark dark:text-warn-light tabular-nums shrink-0">
                      {formatStock(product.stock, product.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
