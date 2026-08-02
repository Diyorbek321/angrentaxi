'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Radar } from 'lucide-react';
import Link from 'next/link';
import { Order, Driver } from '@/lib/api';
import { OrderCard } from './OrderCard';
import { AssignDriverModal } from './AssignDriverModal';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

type OrderFilterTab = 'all' | 'searching' | 'assigned' | 'in_progress' | 'completed';

const matchesTab = (order: Order, tab: OrderFilterTab): boolean => {
  switch (tab) {
    case 'searching':
      return order.status === 'created' || order.status === 'searching';
    case 'assigned':
      return order.status === 'accepted' || order.status === 'arrived';
    case 'in_progress':
      return order.status === 'in_progress';
    case 'completed':
      return order.status === 'completed';
    default:
      return true;
  }
};

interface ActiveOrdersListProps {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  drivers: Driver[];
  onRefetch: () => Promise<void>;
  onOrderUpdated: (order: Order) => void;
  onOrderCancelled: (orderId: string) => void;
  /** Selected order drives the map overlay on the right-hand panel. */
  selectedOrderId?: string | null;
  onSelectOrder?: (order: Order | null) => void;
}

export function ActiveOrdersList({
  orders,
  isLoading,
  error,
  onRefetch,
  onOrderUpdated,
  onOrderCancelled,
  drivers,
  selectedOrderId = null,
  onSelectOrder,
}: ActiveOrdersListProps) {
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [orderForAssign, setOrderForAssign] = useState<Order | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [tab, setTab] = useState<OrderFilterTab>('all');

  const counts = useMemo(
    () => ({
      all: orders.length,
      searching: orders.filter((o) => matchesTab(o, 'searching')).length,
      assigned: orders.filter((o) => matchesTab(o, 'assigned')).length,
      in_progress: orders.filter((o) => matchesTab(o, 'in_progress')).length,
      completed: orders.filter((o) => matchesTab(o, 'completed')).length,
    }),
    [orders]
  );

  const tabs: TabItem<OrderFilterTab>[] = [
    { value: 'all', label: 'Hammasi', count: counts.all },
    { value: 'searching', label: 'Qidirilmoqda', count: counts.searching },
    { value: 'assigned', label: 'Tayinlangan', count: counts.assigned },
    { value: 'in_progress', label: 'Yoʻlda', count: counts.in_progress },
    { value: 'completed', label: 'Yakunlangan', count: counts.completed },
  ];

  const visibleOrders = useMemo(() => orders.filter((o) => matchesTab(o, tab)), [orders, tab]);

  const handleAssignDriver = (order: Order) => {
    setOrderForAssign(order);
    setAssignModalOpen(true);
  };

  const handleAssigned = (updatedOrder: Order) => {
    onOrderUpdated(updatedOrder);
    setAssignModalOpen(false);
    setOrderForAssign(null);
  };

  const handleOpenDetails = (order: Order) => {
    setDetailOrder(order);
    onSelectOrder?.(order);
  };

  if (isLoading && orders.length === 0) {
    return (
      <div className="space-y-3">
        <div className="h-9 w-full skeleton rounded-xl" />
        <SkeletonCards count={3} height="h-44" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Buyurtmalarni yuklab boʻlmadi" message={error} onRetry={onRefetch} />;
  }

  return (
    <>
      <div className="space-y-3">
        <Tabs items={tabs} value={tab} onChange={setTab} size="sm" className="w-full" />

        {visibleOrders.length === 0 ? (
          tab === 'completed' ? (
            <EmptyState
              icon={<CheckCircle2 size={22} />}
              tone="positive"
              title="Yakunlangan buyurtmalar bu yerda qolmaydi"
              description="Buyurtma yakunlangach jonli oqimdan chiqadi."
              action={
                <Link
                  href="/orders"
                  className="text-sm font-semibold text-primary-600 dark:text-primary-300 hover:underline"
                >
                  Buyurtmalar tarixiga oʻtish →
                </Link>
              }
            />
          ) : counts.all === 0 ? (
            <EmptyState
              icon={<Radar size={22} />}
              tone="positive"
              title="Aktiv buyurtma yoʻq"
              description="Yangi buyurtma kelishi bilan shu yerda real vaqtda paydo boʻladi."
            />
          ) : (
            <EmptyState
              title="Bu filtrda buyurtma yoʻq"
              description="Boshqa filtrni tanlang yoki «Hammasi» ga qayting."
              compact
            />
          )
        ) : (
          <div className="flex flex-col gap-3">
            {visibleOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                selected={order.id === selectedOrderId}
                onAssignDriver={handleAssignDriver}
                onOrderUpdated={onOrderUpdated}
                onOrderCancelled={onOrderCancelled}
                onOpenDetails={handleOpenDetails}
              />
            ))}
          </div>
        )}
      </div>

      <OrderDetailDrawer
        order={detailOrder}
        isOpen={detailOrder !== null}
        onClose={() => setDetailOrder(null)}
      />

      <AssignDriverModal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setOrderForAssign(null);
        }}
        order={orderForAssign}
        availableDrivers={drivers}
        onAssigned={handleAssigned}
      />
    </>
  );
}
