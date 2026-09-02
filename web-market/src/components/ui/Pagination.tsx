'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Paged } from '@/hooks/usePagination';
import { Button } from './Button';

const PAGE_SIZES = [25, 50, 100];

/**
 * Jadval osti paneli: diapazon ("1–25 / 118"), sahifa o'lchami va
 * oldinga/orqaga. Bitta sahifaga sig'sa ham diapazon ko'rinib turadi —
 * operator jami sonni har doim biladi.
 */
export function Pagination<T>({ paged, className }: { paged: Paged<T>; className?: string }) {
  const { page, pageCount, pageSize, rangeLabel, setPage, setPageSize } = paged;

  return (
    <div
      className={
        'flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 ' +
        (className ?? '')
      }
    >
      <p className="font-mono text-caption tabular-nums text-muted" aria-live="polite">
        {rangeLabel}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-caption text-muted">
          Sahifada
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Sahifadagi qatorlar soni"
            className="h-8 rounded-ds-xs border border-line bg-surface px-1.5 font-mono text-caption text-ink focus:outline-none focus:ring-2 focus:ring-focus/35"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Oldingi sahifa"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={14} aria-hidden />
        </Button>
        <span className="font-mono text-caption tabular-nums text-muted">
          {page}/{pageCount}
        </span>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Keyingi sahifa"
          disabled={page >= pageCount}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={14} aria-hidden />
        </Button>
      </div>
    </div>
  );
}
