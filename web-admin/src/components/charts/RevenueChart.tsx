'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RevenueDataPoint } from '@/lib/api';
import { CHART_COLORS, CHART_HEIGHT_PX } from '@/lib/chart-tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ChartCard } from './ChartCard';
import { t } from '@/locales';
import { formatAxisDate, formatCompact, formatTooltipMoney } from './axis';

interface RevenueChartProps {
  data: RevenueDataPoint[];
  isLoading?: boolean;
  description?: string;
}

/** Revenue per day — position encodes quantity; horizontal grid only. */
export function RevenueChart({ data, isLoading, description }: RevenueChartProps) {
  const reducedMotion = useReducedMotion();
  const m = t().dashboard.chart;
  return (
    <ChartCard title={m.revenueTitle} description={description} isLoading={isLoading} points={data?.length ?? 0}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -4, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatAxisDate} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatCompact} axisLine={false} tickLine={false} width={56} />
          <Tooltip
            formatter={(value: number) => [formatTooltipMoney(value), m.revenueSeries]}
            labelFormatter={formatAxisDate}
            cursor={{ stroke: CHART_COLORS.primary, strokeOpacity: 0.3 }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            name={m.revenueSeries}
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.primary, strokeWidth: 0 }}
            isAnimationActive={!reducedMotion}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
