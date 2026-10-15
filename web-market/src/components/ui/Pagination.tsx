// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';
import { formatNumber } from '@/lib/format';

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/** Structural match for web-market's `Paged<T>` (hooks/usePagination). */
export interface PagedLike {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  rangeLabel?: string;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export interface PaginationProps {
  /** One-object form (web-market `usePagination` result). */
  paged?: PagedLike;

  page?: number;
  /** Total pages (alias: `pageCount`). */
  totalPages?: number;
  pageCount?: number;
  /** Total rows — enables the "1–20 / 68" range label. */
  total?: number;
  /** Rows per page (alias: `limit`). */
  pageSize?: number;
  limit?: number;
  onPageChange?: (page: number) => void;
  /** Enables the page-size select (alias: `onLimitChange`). */
  onPageSizeChange?: (size: number) => void;
  onLimitChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
  /** Explicit page buttons; negative numbers render as "…". Computed when omitted. */
  pageRange?: number[];
  canGoPrev?: boolean;
  canGoNext?: boolean;
  /** Render page-number buttons (default: true when there are ≤ 1000 pages). */
  showPageNumbers?: boolean;
  className?: string;
}

/** 1 … 4 5 [6] 7 8 … 20 — negative numbers mark gaps. */
export function buildPageRange(page: number, totalPages: number, siblings = 1): number[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const start = Math.max(2, page - siblings);
  const end = Math.min(totalPages - 1, page + siblings);
  const range: number[] = [1];
  if (start > 2) range.push(-1);
  for (let p = start; p <= end; p += 1) range.push(p);
  if (end < totalPages - 1) range.push(-2);
  range.push(totalPages);
  return range;
}

const btn =
  'h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-ds-sm text-[13px] text-muted ' +
  'hover:bg-surface-2 hover:text-ink transition-colors disabled:opacity-40 disabled:pointer-events-none ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * Table footer: "1–20 / 68" · page size · ‹ 1 2 3 › . Accepts either the
 * explicit props (web-admin) or `paged` (web-market). Renders nothing when
 * there is a single page and no total to report.
 */
export function Pagination(props: PaginationProps) {
  const { paged, className } = props;
  const page = paged?.page ?? props.page ?? 1;
  const totalPages = Math.max(1, paged?.pageCount ?? props.totalPages ?? props.pageCount ?? 1);
  const total = paged?.total ?? props.total;
  const pageSize = paged?.pageSize ?? props.pageSize ?? props.limit;
  const onPageChange = paged?.setPage ?? props.onPageChange ?? (() => undefined);
  const onSizeChange = paged?.setPageSize ?? props.onPageSizeChange ?? props.onLimitChange;
  const options: readonly number[] = props.pageSizeOptions ?? (paged ? [25, 50, 100] : PAGE_SIZE_OPTIONS);
  const canPrev = props.canGoPrev ?? page > 1;
  const canNext = props.canGoNext ?? page < totalPages;
  const range = props.pageRange ?? buildPageRange(page, totalPages);
  const showNumbers = props.showPageNumbers ?? true;

  if (totalPages <= 1 && total == null) return null;

  let rangeLabel = paged?.rangeLabel;
  if (!rangeLabel && total != null && pageSize) {
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    rangeLabel = `${formatNumber(from)}–${formatNumber(to)} / ${formatNumber(total)}`;
  }

  return (
    <nav
      aria-label="Sahifalash"
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 border-t border-line text-[13px]',
        className
      )}
    >
      <div className="flex items-center gap-4 text-muted">
        {rangeLabel && <span className="num whitespace-nowrap">{rangeLabel}</span>}
        {onSizeChange && pageSize != null && (
          <label className="flex items-center gap-2 whitespace-nowrap">
            <span className="hidden sm:inline">Sahifada</span>
            <select
              value={pageSize}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              className="num h-7 rounded-ds-sm border border-line bg-surface pl-2 pr-6 text-[13px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {(options.includes(pageSize) ? options : [...options, pageSize].sort((a, b) => a - b)).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={btn}
            onClick={() => onPageChange(page - 1)}
            disabled={!canPrev}
            aria-label="Oldingi sahifa"
          >
            <ChevronLeft size={15} aria-hidden />
          </button>
          {showNumbers ? (
            range.map((p) =>
              p < 0 ? (
                <span key={`gap${p}`} className="px-1 text-subtle" aria-hidden>
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={cn(btn, 'num', p === page && 'bg-surface-2 text-ink font-semibold')}
                >
                  {p}
                </button>
              )
            )
          ) : (
            <span className="num px-2 text-muted">
              {page} / {totalPages}
            </span>
          )}
          <button
            type="button"
            className={btn}
            onClick={() => onPageChange(page + 1)}
            disabled={!canNext}
            aria-label="Keyingi sahifa"
          >
            <ChevronRight size={15} aria-hidden />
          </button>
        </div>
      )}
    </nav>
  );
}
