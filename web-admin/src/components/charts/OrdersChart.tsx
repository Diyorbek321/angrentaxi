'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RevenueDataPoint } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { CHART_BAR_MAX_PX, CHART_COLORS, CHART_HEIGHT_PX } from '@/lib/chart-tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ChartCard } from './ChartCard';
import { t } from '@/locales';
import { formatAxisDate } from './axis';

interface OrdersChartProps {
  data: RevenueDataPoint[];
  isLoading?: boolean;
  description?: string;
}

/** Orders per day — length encodes quantity; horizontal grid only. */
export function OrdersChart({ data, isLoading, description }: OrdersChartProps) {
  const reducedMotion = useReducedMotion();
  const m = t().dashboard.chart;
  return (
    <ChartCard title={m.ordersTitle} description={description} isLoading={isLoading} points={data?.length ?? 0}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatAxisDate} axisLine={false} tickLine={false} />
          <YAxis
            allowDecimals={false}
            tickFormatter={(v: number) => formatNumber(v)}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            formatter={(value: number) => [formatNumber(value), m.ordersSeries]}
            labelFormatter={formatAxisDate}
          />
          <Bar
            dataKey="orders"
            name={m.ordersSeries}
            fill={CHART_COLORS.primary}
            radius={[3, 3, 0, 0]}
            maxBarSize={CHART_BAR_MAX_PX}
            isAnimationActive={!reducedMotion}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
