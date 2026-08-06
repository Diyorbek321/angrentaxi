'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatMoney, formatMoneyShort } from '@/lib/format';
import type { ReportsData } from '@/lib/api';

/**
 * Weekly revenue — one series, so no legend: the card title already names what
 * is plotted. Only the peak and the last day get a direct label; the axis and
 * the hover readout carry the rest, and every value is also in the CSV export.
 *
 * Drawn as plain SVG rather than pulling in a charting library — seven points
 * do not justify the bundle weight.
 */

const W = 640;
const H = 220;
const PAD = { top: 18, right: 20, bottom: 28, left: 56 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Rounds an axis maximum up to a clean number (1 / 2 / 5 × 10ⁿ). */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function RevenueChart({ data }: { data: ReportsData['weeklyRevenue'] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-muted py-10 text-center">Hali ma&apos;lumot yo&apos;q</p>;
  }

  const max = niceMax(Math.max(...data.map((d) => d.total), 1));
  const stepX = data.length > 1 ? PLOT_W / (data.length - 1) : 0;

  const x = (i: number) => PAD.left + i * stepX;
  const y = (value: number) => PAD.top + PLOT_H - (value / max) * PLOT_H;

  const points = data.map((d, i) => ({ ...d, cx: x(i), cy: y(d.total) }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx},${p.cy}`).join(' ');
  const area = `${line} L${points[points.length - 1].cx},${PAD.top + PLOT_H} L${points[0].cx},${PAD.top + PLOT_H} Z`;

  const ticks = [0, max / 2, max];
  const peakIndex = points.reduce((best, p, i) => (p.total > points[best].total ? i : best), 0);
  const lastIndex = points.length - 1;
  const labelled = new Set([peakIndex, lastIndex]);

  const active = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Haftalik tushum grafigi"
        onMouseLeave={() => setHover(null)}
      >
        {/* Gridlines: solid hairlines, one step off the surface. */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-line"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-subtle text-[11px] tabular-nums"
            >
              {formatMoneyShort(tick)}
            </text>
          </g>
        ))}

        <path d={area} className="fill-primary/10" />
        <path
          d={line}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((p, i) => (
          <g key={p.day + i}>
            <text
              x={p.cx}
              y={H - 8}
              textAnchor="middle"
              className={cn('text-[11px]', hover === i ? 'fill-ink' : 'fill-subtle')}
            >
              {p.day}
            </text>

            {/* Markers carry a surface ring so they stay legible on the line. */}
            {(labelled.has(i) || hover === i) && (
              <circle
                cx={p.cx}
                cy={p.cy}
                r={4}
                className="fill-primary stroke-surface"
                strokeWidth={2}
              />
            )}

            {labelled.has(i) && hover === null && (
              <text
                x={p.cx}
                y={p.cy - 12}
                textAnchor={i === lastIndex ? 'end' : 'middle'}
                className="fill-ink text-[11px] font-semibold tabular-nums"
              >
                {formatMoneyShort(p.total)}
              </text>
            )}

            {/* Hit target far wider than the mark. */}
            <rect
              x={p.cx - stepX / 2}
              y={PAD.top}
              width={stepX || PLOT_W}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 shadow-pop"
          style={{ left: `${(active.cx / W) * 100}%`, top: `${(active.cy / H) * 100}%` }}
        >
          <p className="text-2xs text-muted">{active.day}</p>
          <p className="text-xs font-semibold text-ink font-mono tabular-nums whitespace-nowrap">
            {formatMoney(active.total)}
          </p>
        </div>
      )}
    </div>
  );
}
