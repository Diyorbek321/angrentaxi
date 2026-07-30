'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { useOnlineDrivers } from '@/hooks/useOnlineDrivers';
import type { Driver, Order } from '@/lib/api';

/**
 * The shell header shows live order/driver counters and the Live Dispatch
 * screen shows the same data in full. Both read from this one provider so the
 * hooks (and their socket subscriptions) are instantiated exactly once —
 * calling the hooks in both places would double every request on mount.
 *
 * The hooks themselves are untouched; this only shares their result.
 */
export interface DispatchDataValue {
  orders: Order[];
  ordersLoading: boolean;
  ordersError: string | null;
  refetchOrders: () => Promise<void>;

  drivers: Driver[];
  driversLoading: boolean;
  driversError: string | null;
  refetchDrivers: () => Promise<void>;
}

const EMPTY: DispatchDataValue = {
  orders: [],
  ordersLoading: false,
  ordersError: null,
  refetchOrders: async () => {},
  drivers: [],
  driversLoading: false,
  driversError: null,
  refetchDrivers: async () => {},
};

const DispatchDataContext = createContext<DispatchDataValue>(EMPTY);

export function DispatchDataProvider({ children }: { children: ReactNode }) {
  const {
    orders,
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useActiveOrders();

  const {
    drivers,
    isLoading: driversLoading,
    error: driversError,
    refetch: refetchDrivers,
  } = useOnlineDrivers();

  return (
    <DispatchDataContext.Provider
      value={{
        orders,
        ordersLoading,
        ordersError,
        refetchOrders,
        drivers,
        driversLoading,
        driversError,
        refetchDrivers,
      }}
    >
      {children}
    </DispatchDataContext.Provider>
  );
}

export function useDispatchData(): DispatchDataValue {
  return useContext(DispatchDataContext);
}
