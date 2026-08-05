'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { ClipboardList, Clock, Inbox, LayoutGrid, UtensilsCrossed, Wallet } from 'lucide-react';
import { foodApi, DashboardData } from '@/lib/api';
import { useAsyncData } from '@/hooks/useAsyncData';
import { money, formatTime } from '@/lib/utils';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonStats, SkeletonTable } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';

export default function DashboardPage() {
  const load = useCallback(async (): Promise<DashboardData> => {
    const res = await foodApi.getDashboard();
    return res.data.data;
  }, []);

  const { data, status, error, isRefreshing, reload } = useAsyncData<DashboardData>(load, { pollMs: 30000 });

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Bosh sahifa"
        description="Bugungi faoliyat ko'rsatkichlari"
        icon={<LayoutGrid size={20} />}
        actions={
          <>
            {data && (
              <Badge variant={data.isOpen ? 'success' : 'danger'} dot>
                {data.isOpen ? 'Qabul ochiq' : 'Qabul yopiq'}
              </Badge>
            )}
            <Button variant="secondary" onClick={reload} isLoading={isRefreshing}>
              Yangilash
            </Button>
          </>
        }
      />

      {status === 'loading' && (
        <div className="flex flex-col gap-5">
          <SkeletonStats count={4} />
          <SkeletonTable rows={5} cols={5} />
        </div>
      )}

      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' && data && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Bugungi buyurtmalar"
              value={data.todayOrdersCount}
              tone="info"
              icon={<ClipboardList size={20} />}
              live
            />
            <StatTile
              label="Bugungi tushum"
              value={money(data.todayRevenue)}
              tone="mint"
              icon={<Wallet size={20} />}
            />
            <StatTile
              label="O'rtacha tayyorlash"
              value={data.avgPrepMinutes}
              unit="daq"
              tone="override"
              icon={<Clock size={20} />}
              hint="Oxirgi 30 kun bo'yicha"
            />
            <StatTile
              label="Faol taomlar"
              value={data.activeDishesCount}
              tone="neutral"
              icon={<UtensilsCrossed size={20} />}
            />
          </div>

          <Card padding="none">
            <CardHeader className="mb-0 px-5 py-4 border-b border-line">
              <CardTitle>So&apos;nggi buyurtmalar</CardTitle>
              <Link
                href="/dashboard/orders"
                className="text-label text-primary-text hover:underline underline-offset-4"
              >
                Barchasi
              </Link>
            </CardHeader>

            {data.recentOrders.length === 0 ? (
              <EmptyState
                icon={<Inbox size={24} />}
                title="Bugun hali buyurtma yo'q"
                description="Yangi buyurtma kelganda u shu yerda va Buyurtmalar sahifasida ko'rinadi."
                action={
                  <Link href="/dashboard/orders">
                    <Button variant="secondary">Buyurtmalar oqimi</Button>
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <caption className="sr-only">Oxirgi buyurtmalar ro&apos;yxati</caption>
                  <thead>
                    <tr className="text-micro uppercase text-subtle">
                      <th scope="col" className="px-5 py-3 font-extrabold">
                        Raqam
                      </th>
                      <th scope="col" className="px-5 py-3 font-extrabold">
                        Mijoz
                      </th>
                      <th scope="col" className="px-5 py-3 font-extrabold">
                        Taomlar
                      </th>
                      <th scope="col" className="px-5 py-3 font-extrabold">
                        Summa
                      </th>
                      <th scope="col" className="px-5 py-3 font-extrabold">
                        Holat
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {data.recentOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-surface-2/60 transition-colors duration-fast">
                        <td className="px-5 py-3.5 font-mono text-body text-muted">#{o.id.slice(0, 6)}</td>
                        <td className="px-5 py-3.5 text-body font-semibold text-ink">{o.customer}</td>
                        <td className="px-5 py-3.5 text-body text-muted">{o.itemsCount} ta</td>
                        <td className="px-5 py-3.5 font-mono text-body text-ink tabular-nums">
                          {money(o.totalPrice)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <OrderStatusBadge status={o.status} size="sm" />
                            <span className="text-micro text-subtle font-mono">{formatTime(o.createdAt)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Fon yangilanishi uzilib qolsa — sahifa xatoga aylanmaydi, lekin
              foydalanuvchi ma'lumot eskirganini bilishi kerak. */}
          {error && (
            <p role="status" className="text-caption text-override-dark dark:text-override-light">
              Oxirgi yangilash muvaffaqiyatsiz: {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
