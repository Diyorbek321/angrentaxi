'use client';

import { useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Order, Driver } from '@/lib/api';
import { OrderCard } from './OrderCard';
import { AssignDriverModal } from './AssignDriverModal';
import { Button } from '@/components/ui/Button';

interface ActiveOrdersListProps {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  drivers: Driver[];
  onRefetch: () => Promise<void>;
  onOrderUpdated: (order: Order) => void;
  onOrderCancelled: (orderId: string) => void;
}

export function ActiveOrdersList({
  orders,
  isLoading,
  error,
  onRefetch,
  onOrderUpdated,
  onOrderCancelled,
  drivers,
}: ActiveOrdersListProps) {
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const handleAssignDriver = (order: Order) => {
    setSelectedOrder(order);
    setAssignModalOpen(true);
  };

  const handleAssigned = (updatedOrder: Order) => {
    onOrderUpdated(updatedOrder);
    setAssignModalOpen(false);
    setSelectedOrder(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 bg-gray-800 rounded-lg border border-gray-700 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <AlertCircle size={32} className="text-red-400" />
        <div>
          <p className="text-gray-300 font-medium">Failed to load orders</p>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
        </div>
        <Button
          variant="secondary"
          onClick={onRefetch}
          leftIcon={<RefreshCw size={14} />}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="h-14 w-14 rounded-full bg-gray-800 flex items-center justify-center">
          <svg
            className="h-7 w-7 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <div>
          <p className="text-gray-400 font-medium">No active orders</p>
          <p className="text-gray-600 text-sm mt-1">
            New orders will appear here in real-time
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onAssignDriver={handleAssignDriver}
            onOrderUpdated={onOrderUpdated}
            onOrderCancelled={onOrderCancelled}
          />
        ))}
      </div>

      <AssignDriverModal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        availableDrivers={drivers}
        onAssigned={handleAssigned}
      />
    </>
  );
}
