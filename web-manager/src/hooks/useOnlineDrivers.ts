'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getOnlineDrivers, Driver, Coordinates } from '@/lib/api';
import { subscribeToSocket, SOCKET_EVENTS } from '@/lib/socket';

export interface UseOnlineDriversReturn {
  drivers: Driver[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface DriverStatusPayload {
  driverId: string;
  status: Driver['status'];
  driver?: Driver;
}

interface DriverLocationPayload {
  driverId: string;
  location: Coordinates;
}

interface DriverOnlinePayload {
  driver: Driver;
}

interface DriverOfflinePayload {
  driverId: string;
}

export function useOnlineDrivers(): UseOnlineDriversReturn {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchDrivers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getOnlineDrivers();
      if (mountedRef.current) {
        setDrivers(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError('Failed to load online drivers');
        console.error('Error fetching online drivers:', err);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchDrivers();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchDrivers]);

  useEffect(() => {
    const handleDriverStatusChanged = (payload: DriverStatusPayload) => {
      if (!mountedRef.current) return;
      setDrivers((prev) => {
        if (payload.status === 'offline') {
          return prev.filter((d) => d.id !== payload.driverId);
        }
        return prev.map((d) => {
          if (d.id !== payload.driverId) return d;
          return payload.driver ? payload.driver : { ...d, status: payload.status };
        });
      });
    };

    const handleDriverLocation = (payload: DriverLocationPayload) => {
      if (!mountedRef.current) return;
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === payload.driverId ? { ...d, location: payload.location } : d
        )
      );
    };

    const handleDriverOnline = (payload: DriverOnlinePayload) => {
      if (!mountedRef.current) return;
      setDrivers((prev) => {
        const exists = prev.some((d) => d.id === payload.driver.id);
        if (exists) return prev;
        return [...prev, payload.driver];
      });
    };

    const handleDriverOffline = (payload: DriverOfflinePayload) => {
      if (!mountedRef.current) return;
      setDrivers((prev) => prev.filter((d) => d.id !== payload.driverId));
    };

    // The socket is only reachable asynchronously now (its handshake token has
    // to be fetched), so subscription is deferred until it exists.
    return subscribeToSocket((socket) => {
      socket.on(SOCKET_EVENTS.DRIVER_STATUS_CHANGED, handleDriverStatusChanged);
      socket.on(SOCKET_EVENTS.DRIVER_LOCATION, handleDriverLocation);
      socket.on(SOCKET_EVENTS.DRIVER_ONLINE, handleDriverOnline);
      socket.on(SOCKET_EVENTS.DRIVER_OFFLINE, handleDriverOffline);

      return () => {
        socket.off(SOCKET_EVENTS.DRIVER_STATUS_CHANGED, handleDriverStatusChanged);
        socket.off(SOCKET_EVENTS.DRIVER_LOCATION, handleDriverLocation);
        socket.off(SOCKET_EVENTS.DRIVER_ONLINE, handleDriverOnline);
        socket.off(SOCKET_EVENTS.DRIVER_OFFLINE, handleDriverOffline);
      };
    });
  }, []);

  return { drivers, isLoading, error, refetch: fetchDrivers };
}
