'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Grafiklar kechiktirib yuklanadi: recharts ~100 KB, u sahifaning birinchi
 * yuklanishiga kirmasin. Kutish paytida grafikning o'z skeleti bilan bir xil
 * karta ko'rinadi — sahifa sakramaydi.
 */
function ChartSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full rounded-ds-md" />
      </CardContent>
    </Card>
  );
}

export const OrdersChart = dynamic(() => import('./OrdersChart').then((m) => m.OrdersChart), {
  ssr: false,
  loading: () => <ChartSkeleton title="Buyurtmalar soni" />,
});

export const RevenueChart = dynamic(() => import('./RevenueChart').then((m) => m.RevenueChart), {
  ssr: false,
  loading: () => <ChartSkeleton title="Daromad dinamikasi" />,
});
