'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Order, PaginatedResponse } from '@/lib/api';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { OrderStatusBadge } from './OrderStatusBadge';
import { Button } from '@/components/ui/Button';

interface OrdersTableProps {
  data: PaginatedResponse<Order>;
  currentPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function OrdersTable({
  data,
  currentPage,
  onPageChange,
  isLoading = false,
}: OrdersTableProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading orders...
      </div>
    );
  }

  if (data.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <p className="text-sm">No orders found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Passenger</th>
              <th className="px-4 py-3">Pickup</th>
              <th className="px-4 py-3">Dropoff</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Driver</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {data.data.map((order) => (
              <tr
                key={order.id}
                className="bg-gray-900 hover:bg-gray-800 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-400">
                  #{order.id.slice(-6).toUpperCase()}
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-gray-100 font-medium">{order.passenger.name}</p>
                    <p className="text-gray-500 text-xs">{order.passenger.phone}</p>
                  </div>
                </td>
                <td className="px-4 py-3 max-w-[150px]">
                  <p className="text-gray-300 truncate text-xs">
                    {order.pickupAddress.address}
                  </p>
                </td>
                <td className="px-4 py-3 max-w-[150px]">
                  <p className="text-gray-300 truncate text-xs">
                    {order.dropoffAddress.address}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} size="sm" />
                </td>
                <td className="px-4 py-3">
                  {order.driver ? (
                    <div>
                      <p className="text-gray-200 text-xs font-medium">
                        {order.driver.name}
                      </p>
                      <p className="text-gray-500 text-xs">{order.driver.carNumber}</p>
                    </div>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                </td>
                <td className="px-4 py-3 text-gray-200 text-xs font-medium">
                  {order.finalPrice != null
                    ? `${order.finalPrice.toLocaleString()} ${order.tariff.currency}`
                    : order.estimatedPrice > 0
                    ? `~${order.estimatedPrice.toLocaleString()} ${order.tariff.currency}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {format(new Date(order.createdAt), 'dd MMM, HH:mm')}
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/orders/${order.id}`)}
                    leftIcon={<Eye size={14} />}
                  >
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <p>
          Showing {(currentPage - 1) * data.limit + 1}–
          {Math.min(currentPage * data.limit, data.total)} of {data.total} orders
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            leftIcon={<ChevronLeft size={14} />}
          >
            Prev
          </Button>
          <span className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-md text-gray-300">
            {currentPage} / {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= data.totalPages}
            rightIcon={<ChevronRight size={14} />}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
