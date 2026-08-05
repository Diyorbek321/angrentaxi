'use client';

import {
  LineChart,
  Line,
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

interface RevenueChartProps {
  data: RevenueDataPoint[];
  isLoading?: boolean;
}

const formatRevenue = (value: number) =>
  new Intl.NumberFormat('uz-UZ', { notation: 'compact' }).format(value) + ' UZS';

const formatAxisDate = (dateStr: string) => {
  try {
    return format(parseISO(dateStr), 'dd.MM');
  } catch {
    return dateStr;
  }
};

export function RevenueChart({ data, isLoading }: RevenueChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daromad dinamikasi</CardTitle>
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
          <CardTitle>Daromad dinamikasi</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            compact
            title="Maʼlumot yoʻq"
            description="Tanlangan davr uchun daromad maʼlumoti topilmadi."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daromad dinamikasi</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            {/* To'r, o'q va tooltip ranglari globals.css dagi `.recharts-*`
                qoidalari orqali temaga bog'langan. */}
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatRevenue}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              formatter={(value: number) => [formatRevenue(value), 'Daromad']}
              labelFormatter={formatAxisDate}
              cursor={{ stroke: CHART_COLORS.primary, strokeOpacity: 0.3 }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Daromad"
              stroke={CHART_COLORS.primary}
              strokeWidth={2.5}
              dot={{ r: 4, fill: CHART_COLORS.primary, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: CHART_COLORS.primary }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
