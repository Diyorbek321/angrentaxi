import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { CHART_HEIGHT_PX, CHART_MIN_POINTS, CHART_NOT_ENOUGH_DATA } from '@/lib/chart-tokens';

export interface ChartCardProps {
  title: string;
  description?: ReactNode;
  isLoading?: boolean;
  /** Number of data points; < CHART_MIN_POINTS renders the empty state. */
  points: number;
  children: ReactNode;
}

/**
 * Frame shared by every chart: same header, same 240px plot area, the same
 * skeleton while loading and the same "not enough data" state — so a chart
 * never jumps between states and never draws a single giant bar.
 */
export function ChartCard({ title, description, isLoading = false, points, children }: ChartCardProps) {
  return (
    <Card padding="none">
      <CardHeader title={title} description={description} />
      <CardBody>
        {isLoading ? (
          <Skeleton className="w-full rounded-ds-sm" style={{ height: CHART_HEIGHT_PX }} />
        ) : points < CHART_MIN_POINTS ? (
          // Compact on purpose: a 240px void per empty chart made the whole
          // dashboard look hollow. The card shrinks to ~150px total.
          <div role="status" className="flex items-center gap-3 rounded-ds-sm bg-surface-2 px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-sm bg-surface text-muted border border-line">
              <BarChart3 size={16} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{CHART_NOT_ENOUGH_DATA}</p>
              <p className="text-xs text-muted mt-0.5">Kamida 3 kunlik maʼlumot toʻplanganda trend koʻrinadi.</p>
            </div>
          </div>
        ) : (
          children
        )}
      </CardBody>
    </Card>
  );
}

export function ChartSkeleton({ title }: { title: string }) {
  return (
    <ChartCard title={title} isLoading points={0}>
      {null}
    </ChartCard>
  );
}
