'use client';

import { useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Filter } from 'lucide-react';
import {
  Badge,
  Card,
  DateRangeFilter,
  EmptyState,
  ErrorState,
  PageHeader,
  RetryBanner,
  Skeleton,
  rangeForPreset,
  type DateRangeValue,
} from '@/components/ui';
import { useResource } from '@/hooks/useResource';
import { funnelApi } from '@/lib/api';
import { funnelRows, hasAppData, type FunnelRow } from '@/lib/funnel';
import { formatNumber } from '@/lib/format';
import { t } from '@/locales';

const DEFAULT_RANGE: DateRangeValue = { preset: '30d', ...rangeForPreset('30d') };
/** Backend `MAX_FUNNEL_RANGE_DAYS`. */
const MAX_RANGE_DAYS = 92;

function StepBar({ row }: { row: FunnelRow }) {
  const f = t().funnel;
  return (
    <li className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 sm:grid-cols-[14rem_1fr_7rem]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{f.steps[row.step]}</p>
        <Badge variant="neutral" className="mt-0.5">
          {row.source === 'app' ? f.sourceApp : f.sourceServer}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-6 flex-1 overflow-hidden rounded-ds-xs bg-surface-2" aria-hidden="true">
          <div
            className={row.source === 'app' ? 'h-full bg-primary' : 'h-full bg-primary/60'}
            style={{ width: `${row.widthPct}%` }}
          />
        </div>
        <span className="num w-14 text-right text-sm font-semibold text-ink">{formatNumber(row.count)}</span>
      </div>
      <span className="num col-span-2 text-xs text-muted sm:col-span-1 sm:text-right">
        {row.fromPrevPct == null ? f.fromPrevNone : f.fromPrev(row.fromPrevPct)}
      </span>
    </li>
  );
}

/** Anonim yo'lovchi voronkasi (backend `GET /analytics/funnel`). */
export default function FunnelPage() {
  const f = t().funnel;
  const [range, setRange] = useState<DateRangeValue>(DEFAULT_RANGE);
  const from = range.from ?? DEFAULT_RANGE.from!;
  const to = range.to ?? DEFAULT_RANGE.to!;
  const tooLong = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1 > MAX_RANGE_DAYS;

  const res = useResource(
    () => (tooLong ? Promise.resolve(null) : funnelApi.get({ from, to }).then((r) => r.data.data)),
    f.loadError,
    [from, to, tooLong]
  );
  const report = res.data;
  const rows = report ? funnelRows(report) : [];
  const empty = report != null && rows.every((r) => r.count === 0);

  return (
    <div className="px-4 py-5 sm:px-6">
      <PageHeader title={f.title} description={f.description} />

      <div className="mb-4 space-y-3">
        <DateRangeFilter value={range} onChange={(v) => setRange(v.preset ? v : DEFAULT_RANGE)} />
        {tooLong && <p className="text-sm text-danger">{f.rangeLimit}</p>}
        {res.error && res.hasLoaded && (
          <RetryBanner message={res.error} onRetry={res.reload} keepsLastData retrying={res.loading} />
        )}
      </div>

      <Card padding="lg">
        {res.error && !res.hasLoaded ? (
          <ErrorState message={res.error} onRetry={res.reload} />
        ) : res.loading && !res.hasLoaded ? (
          <div className="space-y-3">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-10 rounded-ds-sm" />
            ))}
          </div>
        ) : empty || !report ? (
          <EmptyState variant="no-results" icon={<Filter aria-hidden />} title={f.emptyTitle} description={f.emptyDesc} />
        ) : (
          <>
            {!hasAppData(report) && (
              <div className="mb-4 rounded-ds-sm bg-surface-2 p-3">
                <p className="text-sm font-medium text-ink">{f.noAppTitle}</p>
                <p className="mt-1 text-xs text-muted">{f.noAppDesc}</p>
              </div>
            )}
            <ol aria-label={f.chartAria} className="space-y-3">
              {rows.map((row) => (
                <StepBar key={row.step} row={row} />
              ))}
            </ol>
          </>
        )}
      </Card>

      <p className="mt-3 max-w-3xl text-xs text-muted">{f.note}</p>
    </div>
  );
}
