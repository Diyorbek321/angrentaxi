'use client';

import dynamic from 'next/dynamic';
import { Driver } from '@/lib/api';

// Leaflet touches `window` at import time, which breaks Next.js SSR — load
// the actual map client-side only.
const DriverMapInner = dynamic(() => import('./DriverMapInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-500">
      Xarita yuklanmoqda...
    </div>
  ),
});

interface DriverMapProps {
  drivers: Driver[];
  isLoading?: boolean;
}

export function DriverMap({ drivers, isLoading }: DriverMapProps) {
  const locatedCount = drivers.filter((d) => d.location).length;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Yuklanmoqda...
      </div>
    );
  }

  if (locatedCount === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-gray-500">
        <p>Hech qanday haydovchi joylashuvi topilmadi</p>
        <p className="text-xs text-gray-600">Onlayn haydovchilar joylashuvni yuborganda shu yerda ko&apos;rinadi</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden rounded-lg">
      <DriverMapInner drivers={drivers} />
    </div>
  );
}
