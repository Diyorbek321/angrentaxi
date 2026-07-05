'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft,
  User,
  MapPin,
  Car,
  CreditCard,
  Clock,
  Ban,
  CheckCircle,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { getOrderById, cancelOrder, completeOrder, Order } from '@/lib/api';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { AssignDriverModal } from '@/components/dispatch/AssignDriverModal';
import { useOnlineDrivers } from '@/hooks/useOnlineDrivers';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-700/50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-200 text-right">{value}</span>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const { drivers } = useOnlineDrivers();

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    getOrderById(id)
      .then(setOrder)
      .catch(() => setError('Order not found'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleCancel = async () => {
    if (!order || !confirm('Cancel this order?')) return;
    setIsCancelling(true);
    try {
      const updated = await cancelOrder(order.id, 'Cancelled by dispatcher');
      setOrder(updated);
    } catch {
      alert('Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleComplete = async () => {
    if (!order || !confirm('Mark as completed?')) return;
    setIsCompleting(true);
    try {
      const updated = await completeOrder(order.id);
      setOrder(updated);
    } catch {
      alert('Failed to complete order');
    } finally {
      setIsCompleting(false);
    }
  };

  const canAssign = order && ['created', 'searching'].includes(order.status) && !order.driver;
  const canReassign = order && ['accepted', 'arrived'].includes(order.status) && !!order.driver;
  const canCancel = order && ['created', 'searching', 'accepted', 'arrived'].includes(order.status);
  const canComplete = order && order.status === 'in_progress';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-64 text-center">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-gray-300">{error ?? 'Order not found'}</p>
        <Button variant="secondary" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            leftIcon={<ArrowLeft size={14} />}
          >
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-100">
                Order #{order.id.slice(-8).toUpperCase()}
              </h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Created {format(new Date(order.createdAt), 'dd MMMM yyyy, HH:mm')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {(canAssign || canReassign) && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setAssignModalOpen(true)}
              leftIcon={<UserCheck size={13} />}
            >
              {canReassign ? 'Reassign Driver' : 'Assign Driver'}
            </Button>
          )}
          {canComplete && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleComplete}
              isLoading={isCompleting}
              leftIcon={<CheckCircle size={13} />}
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
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Passenger */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={15} className="text-gray-500" />
              Passenger
            </CardTitle>
          </CardHeader>
          <InfoRow label="Name" value={order.passenger.name} />
          <InfoRow label="Phone" value={order.passenger.phone} />
        </Card>

        {/* Driver */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car size={15} className="text-gray-500" />
              Driver
            </CardTitle>
          </CardHeader>
          {order.driver ? (
            <>
              <InfoRow label="Name" value={order.driver.name} />
              <InfoRow label="Phone" value={order.driver.phone} />
              <InfoRow label="Car" value={`${order.driver.carModel} — ${order.driver.carNumber}`} />
              <InfoRow label="Rating" value={`⭐ ${order.driver.rating.toFixed(1)}`} />
            </>
          ) : (
            <p className="text-gray-600 text-sm py-2">No driver assigned</p>
          )}
        </Card>

        {/* Route */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin size={15} className="text-gray-500" />
              Route
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Pickup</p>
              <p className="text-sm text-gray-200">{order.pickupAddress ?? '—'}</p>
              <p className="text-xs text-gray-600 mt-0.5 font-mono">
                {order.pickupLocation.coordinates[1].toFixed(6)},{' '}
                {order.pickupLocation.coordinates[0].toFixed(6)}
              </p>
            </div>
            <div className="border-t border-gray-700" />
            <div>
              <p className="text-xs text-gray-500 mb-1">Dropoff</p>
              <p className="text-sm text-gray-200">{order.dropoffAddress ?? '—'}</p>
              <p className="text-xs text-gray-600 mt-0.5 font-mono">
                {order.dropoffLocation.coordinates[1].toFixed(6)},{' '}
                {order.dropoffLocation.coordinates[0].toFixed(6)}
              </p>
            </div>
          </div>
        </Card>

        {/* Payment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={15} className="text-gray-500" />
              Payment
            </CardTitle>
          </CardHeader>
          <InfoRow
            label="Method"
            value={PAYMENT_METHOD_LABELS[order.paymentMethod]}
          />
          <InfoRow label="Tariff" value={order.tariff.name} />
          <InfoRow
            label="Estimated"
            value={`${order.estimatedPrice.toLocaleString()} UZS`}
          />
          <InfoRow
            label="Final"
            value={
              order.finalPrice != null
                ? `${order.finalPrice.toLocaleString()} UZS`
                : '—'
            }
          />
        </Card>

        {/* Timeline */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={15} className="text-gray-500" />
              Timeline
            </CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Created', ts: order.createdAt },
              { label: 'Accepted', ts: order.acceptedAt },
              { label: 'Started', ts: order.startedAt },
              {
                label: order.cancelledAt ? 'Cancelled' : 'Completed',
                ts: order.cancelledAt ?? order.completedAt,
              },
            ].map(({ label, ts }) => (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm text-gray-300 mt-0.5">
                  {ts ? format(new Date(ts), 'dd MMM, HH:mm') : '—'}
                </p>
              </div>
            ))}
          </div>
          {order.note && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Note</p>
              <p className="text-sm text-gray-300">{order.note}</p>
            </div>
          )}
        </Card>
      </div>

      <AssignDriverModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        order={order}
        availableDrivers={drivers}
        onAssigned={(updated) => {
          setOrder(updated);
          setAssignModalOpen(false);
        }}
      />
    </div>
  );
}
