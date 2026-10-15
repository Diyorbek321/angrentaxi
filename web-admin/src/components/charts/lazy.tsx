'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from './ChartCard';

/**
 * Charts load lazily: recharts is ~100 KB and must not weigh on the first
 * paint. While it loads, the same card frame + skeleton is shown — no jump.
 */
export const OrdersChart = dynamic(() => import('./OrdersChart').then((m) => m.OrdersChart), {
  ssr: false,
  loading: () => <ChartSkeleton title="Buyurtmalar soni" />,
});

export const RevenueChart = dynamic(() => import('./RevenueChart').then((m) => m.RevenueChart), {
  ssr: false,
  loading: () => <ChartSkeleton title="Daromad dinamikasi" />,
});
