import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  totalPages: number;
  pageRange: number[];
  canGoPrev: boolean;
  canGoNext: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  pageRange,
  canGoPrev,
  canGoNext,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      role="navigation"
      aria-label="Sahifalash"
      className={cn('flex items-center justify-center gap-1', className)}
    >
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(page - 1)}
        disabled={!canGoPrev}
        aria-label="Oldingi sahifa"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pageRange.map((p, idx) => {
        if (p < 0) {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="flex h-8 w-8 items-center justify-center text-subtle"
              aria-hidden="true"
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
          );
        }
        const current = p === page;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-ds-sm text-body font-semibold transition-colors duration-fast',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              current
                ? 'bg-primary text-white dark:bg-primary-on-dark'
                : 'text-muted hover:bg-surface-2 hover:text-ink'
            )}
            aria-current={current ? 'page' : undefined}
            aria-label={current ? `${p}-sahifa, joriy` : `${p}-sahifaga o'tish`}
          >
            {p}
          </button>
        );
      })}

      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(page + 1)}
        disabled={!canGoNext}
        aria-label="Keyingi sahifa"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
