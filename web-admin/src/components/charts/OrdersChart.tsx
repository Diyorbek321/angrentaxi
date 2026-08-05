'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { RevenueDataPoint } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { CHART_COLORS } from '@/lib/chart-tokens';

interface OrdersChartProps {
  data: RevenueDataPoint[];
  isLoading?: boolean;
}

const formatAxisDate = (dateStr: string) => {
  try {
    return format(parseISO(dateStr), 'dd.MM');
  } catch {
    return dateStr;
  }
};

export function OrdersChart({ data, isLoading }: OrdersChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Buyurtmalar soni</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Spinner emas — diagramma shakliga mos skeleton. */}
          <Skeleton className="h-[300px] w-full rounded-ds-md" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Buyurtmalar soni</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            compact
            title="Maʼlumot yoʻq"
            description="Tanlangan davr uchun buyurtma maʼlumoti topilmadi."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buyurtmalar soni</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value: number) => [value, 'Buyurtmalar']}
              labelFormatter={formatAxisDate}
              cursor={{ fill: 'rgba(16,160,100,0.08)' }}
            />
            <Legend />
            <Bar
              dataKey="orders"
              name="Buyurtmalar"
              fill={CHART_COLORS.primary}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
