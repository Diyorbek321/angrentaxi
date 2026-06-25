'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getActiveOrders, Order } from '@/lib/api';
import { getSocket, SOCKET_EVENTS } from '@/lib/socket';
import { getAuthToken } from '@/lib/auth';
import { ACTIVE_ORDER_STATUSES } from '@/lib/constants';

export interface UseActiveOrdersReturn {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useActiveOrders(): UseActiveOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getActiveOrders();
      if (mountedRef.current) {
        setOrders(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError('Failed to load active orders');
        console.error('Error fetching active orders:', err);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchOrders();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchOrders]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const socket = getSocket(token);

    const handleOrderCreated = (newOrder: Order) => {
      if (!mountedRef.current) return;
      setOrders((prev) => {
        // Avoid duplicates
        const exists = prev.some((o) => o.id === newOrder.id);
        if (exists) return prev;
        return [newOrder, ...prev];
      });
    };

    const handleOrderUpdated = (updatedOrder: Order) => {
      if (!mountedRef.current) return;
      setOrders((prev) => {
        if (!(ACTIVE_ORDER_STATUSES as readonly string[]).includes(updatedOrder.status)) {
          // Remove from active list if no longer active
          return prev.filter((o) => o.id !== updatedOrder.id);
        }
        return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
      });
    };

    const handleOrderCancelled = (cancelledOrder: Order) => {
      if (!mountedRef.current) return;
      setOrders((prev) => prev.filter((o) => o.id !== cancelledOrder.id));
    };

    const handleOrderCompleted = (completedOrder: Order) => {
      if (!mountedRef.current) return;
      setOrders((prev) => prev.filter((o) => o.id !== completedOrder.id));
    };

    socket.on(SOCKET_EVENTS.ORDER_CREATED, handleOrderCreated);
    socket.on(SOCKET_EVENTS.ORDER_UPDATED, handleOrderUpdated);
    socket.on(SOCKET_EVENTS.ORDER_CANCELLED, handleOrderCancelled);
    socket.on(SOCKET_EVENTS.ORDER_COMPLETED, handleOrderCompleted);

    return () => {
      socket.off(SOCKET_EVENTS.ORDER_CREATED, handleOrderCreated);
      socket.off(SOCKET_EVENTS.ORDER_UPDATED, handleOrderUpdated);
      socket.off(SOCKET_EVENTS.ORDER_CANCELLED, handleOrderCancelled);
      socket.off(SOCKET_EVENTS.ORDER_COMPLETED, handleOrderCompleted);
    };
  }, []);

  return { orders, isLoading, error, refetch: fetchOrders };
}
