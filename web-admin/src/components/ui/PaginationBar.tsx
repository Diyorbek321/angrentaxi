'use client';

import { Pagination } from './Pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './Select';

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

interface PaginationBarProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  pageRange: number[];
  canGoPrev: boolean;
  canGoNext: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

/**
 * Jadval osti paneli: joriy oraliq ("1–20 / 1 204"), sahifa hajmi tanlovi va
 * sahifalash — data-tables doktrinasi bo'yicha har uchalasi birga.
 */
export function PaginationBar({
  page,
  limit,
  total,
  totalPages,
  pageRange,
  canGoPrev,
  canGoNext,
  onPageChange,
  onLimitChange,
}: PaginationBarProps) {
  const from = total === 0 ? 0 : Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-body tabular-nums text-muted">
        <span className="font-medium text-ink">
          {from}–{to}
        </span>{' '}
        / {total.toLocaleString('uz-UZ')} ta
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-caption text-muted">Sahifada:</span>
          <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
            <SelectTrigger className="h-8 w-20" aria-label="Sahifadagi qatorlar soni">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          pageRange={pageRange}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
