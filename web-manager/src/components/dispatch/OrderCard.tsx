'use client';

import { useState } from 'react';
import { MapPin, User, Clock, Phone, Ban, CheckCircle, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Order, cancelOrder, completeOrder } from '@/lib/api';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';

interface OrderCardProps {
  order: Order;
  onAssignDriver: (order: Order) => void;
  onOrderUpdated: (order: Order) => void;
  onOrderCancelled: (orderId: string) => void;
}

export function OrderCard({
  order,
  onAssignDriver,
  onOrderUpdated,
  onOrderCancelled,
}: OrderCardProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const canAssign = ['created', 'searching'].includes(order.status) && !order.driver;
  const canReassign = ['accepted', 'arrived'].includes(order.status) && !!order.driver;
  const canCancel = ['created', 'searching', 'accepted', 'arrived'].includes(order.status);
  const canComplete = order.status === 'in_progress';

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setIsCancelling(true);
    try {
      const updated = await cancelOrder(order.id, 'Cancelled by dispatcher');
      onOrderCancelled(updated.id);
    } catch (err) {
      console.error('Cancel failed:', err);
      alert('Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('Mark this order as completed?')) return;
    setIsCompleting(true);
    try {
      const updated = await completeOrder(order.id);
      onOrderUpdated(updated);
    } catch (err) {
      console.error('Complete failed:', err);
      alert('Failed to complete order');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Top accent bar based on status */}
      <div
        className={`h-0.5 w-full ${
          order.status === 'searching'
            ? 'bg-blue-500'
            : order.status === 'accepted'
            ? 'bg-green-500'
            : order.status === 'arrived'
            ? 'bg-yellow-500'
            : order.status === 'in_progress'
            ? 'bg-orange-500'
            : 'bg-gray-600'
        }`}
      />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs text-gray-500">
              #{order.id.slice(-6).toUpperCase()}
            </span>
            <OrderStatusBadge status={order.status} size="sm" />
          </div>
          <div className="flex items-center gap-1.5 text-gray-500 text-xs shrink-0">
            <Clock size={12} />
            {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
          </div>
        </div>

        {/* Passenger info */}
        <div className="flex items-center gap-2">
          <User size={14} className="text-gray-500 shrink-0" />
          <span className="text-gray-200 text-sm font-medium truncate">
            {order.passenger.name}
          </span>
          <Phone size={12} className="text-gray-600 ml-auto shrink-0" />
          <span className="text-gray-500 text-xs">{order.passenger.phone}</span>
        </div>

        {/* Addresses */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-2 w-2 rounded-full bg-accent-500 shrink-0" />
            <p className="text-gray-300 text-xs leading-tight line-clamp-2">
              {order.pickupAddress ?? '—'}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-gray-300 text-xs leading-tight line-clamp-2">
              {order.dropoffAddress ?? '—'}
            </p>
          </div>
        </div>

        {/* Driver info or placeholder */}
        {order.driver ? (
          <div className="flex items-center gap-2 bg-gray-700/50 rounded-md px-3 py-2">
            <div className="h-6 w-6 rounded-full bg-gray-600 flex items-center justify-center shrink-0">
              <User size={12} className="text-gray-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-200 text-xs font-medium truncate">
                {order.driver.name}
              </p>
              <p className="text-gray-500 text-xs">{order.driver.carNumber}</p>
            </div>
            <span className="text-gray-400 text-xs">⭐ {order.driver.rating.toFixed(1)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-gray-700/30 rounded-md px-3 py-2 border border-dashed border-gray-700">
            <p className="text-gray-600 text-xs">No driver assigned</p>
          </div>
        )}

        {/* Price and payment */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {PAYMENT_METHOD_LABELS[order.paymentMethod]}
          </span>
          <span className="text-gray-300 font-medium">
            {order.finalPrice != null
              ? `${order.finalPrice.toLocaleString()} UZS`
              : `~${order.estimatedPrice.toLocaleString()} UZS`}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {canAssign && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onAssignDriver(order)}
              leftIcon={<UserCheck size={13} />}
              className="flex-1"
            >
              Assign Driver
            </Button>
          )}
          {canReassign && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onAssignDriver(order)}
              leftIcon={<UserCheck size={13} />}
              className="flex-1"
            >
              Reassign
            </Button>
          )}
          {canComplete && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleComplete}
              isLoading={isCompleting}
              leftIcon={<CheckCircle size={13} />}
              className="flex-1"
            >
              Complete
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="danger"
              onClick={handleCancel}
              isLoading={isCancelling}
              leftIcon={<Ban size={13} />}
              className={canAssign || canReassign || canComplete ? '' : 'flex-1'}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
