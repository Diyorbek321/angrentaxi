'use client';

import { AlertCircle, RefreshCw, Users } from 'lucide-react';
import { Driver } from '@/lib/api';
import { DriverCard } from './DriverCard';
import { Button } from '@/components/ui/Button';

interface OnlineDriversListProps {
  drivers: Driver[];
  isLoading: boolean;
  error: string | null;
  onRefetch: () => Promise<void>;
}

export function OnlineDriversList({
  drivers,
  isLoading,
  error,
  onRefetch,
}: OnlineDriversListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-20 bg-gray-800 rounded-lg border border-gray-700 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <AlertCircle size={32} className="text-red-400" />
        <div>
          <p className="text-gray-300 font-medium">Failed to load drivers</p>
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

  if (drivers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="h-14 w-14 rounded-full bg-gray-800 flex items-center justify-center">
          <Users size={24} className="text-gray-600" />
        </div>
        <div>
          <p className="text-gray-400 font-medium">No drivers online</p>
          <p className="text-gray-600 text-sm mt-1">
            Drivers will appear here when they go online
          </p>
        </div>
      </div>
    );
  }

  const availableDrivers = drivers.filter((d) => !d.currentOrderId);
  const busyDrivers = drivers.filter((d) => !!d.currentOrderId);

  return (
    <div className="space-y-4">
      {availableDrivers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">
            Available ({availableDrivers.length})
          </h4>
          {availableDrivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      )}

      {busyDrivers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">
            On Trip ({busyDrivers.length})
          </h4>
          {busyDrivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      )}
    </div>
  );
}
