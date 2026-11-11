'use client';

import { Users } from 'lucide-react';
import { Driver } from '@/lib/api';
import { DriverCard } from './DriverCard';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { t } from '@/locales';

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
  const m = t().dispatch.driversList;
  const labels = t().lib.driverStatus;
  if (isLoading && drivers.length === 0) {
    return <SkeletonCards count={4} height="h-[88px]" />;
  }

  if (error) {
    return <ErrorState title={m.loadFailed} message={error} onRetry={onRefetch} />;
  }

  if (drivers.length === 0) {
    return (
      <EmptyState
        icon={<Users aria-hidden />}
        title={m.emptyTitle}
        description={m.emptyDesc}
      />
    );
  }

  const availableDrivers = drivers.filter((d) => !d.currentOrderId);
  const busyDrivers = drivers.filter((d) => !!d.currentOrderId);

  return (
    <div className="space-y-4">
      {availableDrivers.length > 0 && (
        <div className="space-y-2">
          <h4 className="px-1 text-micro uppercase text-subtle">
            {labels.online} ({availableDrivers.length})
          </h4>
          {availableDrivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      )}

      {busyDrivers.length > 0 && (
        <div className="space-y-2">
          <h4 className="px-1 text-micro uppercase text-subtle">
            {labels.busy} ({busyDrivers.length})
          </h4>
          {busyDrivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      )}
    </div>
  );
}
