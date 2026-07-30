'use client';

import { Users } from 'lucide-react';
import { Driver } from '@/lib/api';
import { DriverCard } from './DriverCard';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

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
  if (isLoading && drivers.length === 0) {
    return <SkeletonCards count={4} height="h-24" />;
  }

  if (error) {
    return <ErrorState title="Haydovchilarni yuklab boʻlmadi" message={error} onRetry={onRefetch} />;
  }

  if (drivers.length === 0) {
    return (
      <EmptyState
        icon={<Users size={22} />}
        title="Onlayn haydovchi yoʻq"
        description="Haydovchilar smenaga chiqishi bilan shu yerda koʻrinadi."
      />
    );
  }

  const availableDrivers = drivers.filter((d) => !d.currentOrderId);
  const busyDrivers = drivers.filter((d) => !!d.currentOrderId);

  return (
    <div className="space-y-4">
      {availableDrivers.length > 0 && (
        <div className="space-y-2">
          <h4 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">
            Boʻsh ({availableDrivers.length})
          </h4>
          {availableDrivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      )}

      {busyDrivers.length > 0 && (
        <div className="space-y-2">
          <h4 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">
            Band ({busyDrivers.length})
          </h4>
          {busyDrivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      )}
    </div>
  );
}
