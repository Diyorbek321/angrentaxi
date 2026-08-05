'use client';

import dynamic from 'next/dynamic';
import { MapPin, X } from 'lucide-react';
import { Driver, Order } from '@/lib/api';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { shortId } from '@/lib/format';

// Leaflet touches `window` at import time, which breaks Next.js SSR — load
// the actual map client-side only.
const DriverMapInner = dynamic(() => import('./DriverMapInner'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

interface DriverMapProps {
  drivers: Driver[];
  isLoading?: boolean;
  /** Draws this order's pickup/dropoff and route line over the drivers. */
  selectedOrder?: Order | null;
  onClearSelection?: () => void;
}

/** City-wide density readout floating over the map. */
function DensityPanel({ drivers }: { drivers: Driver[] }) {
  const total = drivers.length;
  const busy = drivers.filter((d) => !!d.currentOrderId).length;
  const free = total - busy;
  const busyPercent = total === 0 ? 0 : Math.round((busy / total) * 100);

  return (
    <div className="absolute top-3 left-3 z-[1000] glass-card px-3 py-2.5 w-52 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle mb-2">
        Shahar boʻyicha zichlik
      </p>
      <div className="flex items-end justify-between gap-2 mb-2">
        <span className="font-mono text-lg font-bold text-primary-700 dark:text-primary-300 leading-none">
          {free}
        </span>
        <span className="text-[11px] text-muted">boʻsh</span>
        <span className="font-mono text-lg font-bold text-muted leading-none ml-auto">{busy}</span>
        <span className="text-[11px] text-muted">band</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden flex">
        <div className="h-full bg-mint-deep" style={{ width: `${100 - busyPercent}%` }} />
        <div className="h-full bg-line-strong" style={{ width: `${busyPercent}%` }} />
      </div>
      <p className="text-[11px] text-subtle mt-1.5">
        {total} ta onlayn · {busyPercent}% band
      </p>
    </div>
  );
}

export function DriverMap({
  drivers,
  isLoading,
  selectedOrder = null,
  onClearSelection,
}: DriverMapProps) {
  const locatedCount = drivers.filter((d) => d.location).length;

  if (isLoading && drivers.length === 0) {
    return <Skeleton className="h-full w-full rounded-none" />;
  }

  if (locatedCount === 0 && !selectedOrder) {
    return (
      <EmptyState
        icon={<MapPin size={22} />}
        title="Haydovchi joylashuvi yoʻq"
        description="Onlayn haydovchilar joylashuvni yuborishi bilan xaritada koʻrinadi."
      />
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <DriverMapInner drivers={drivers} selectedOrder={selectedOrder} />
      <DensityPanel drivers={drivers} />

      {selectedOrder && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000] glass-card px-3 py-2.5 flex items-center gap-3 shadow-card">
          <span className="font-mono text-xs font-semibold text-ink shrink-0">
            {shortId(selectedOrder.id)}
          </span>
          <p className="text-xs text-muted truncate">
            {selectedOrder.pickupAddress ?? '—'} → {selectedOrder.dropoffAddress ?? '—'}
          </p>
          {onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Tanlovni bekor qilish"
              className="ml-auto shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-surface-2 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
