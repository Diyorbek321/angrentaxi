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
      aria-label="Pagination"
      className={cn('flex items-center justify-center gap-1', className)}
    >
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(page - 1)}
        disabled={!canGoPrev}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pageRange.map((p, idx) => {
        if (p < 0) {
          return (
            <span key={`ellipsis-${idx}`} className="flex h-8 w-8 items-center justify-center">
              <MoreHorizontal className="h-4 w-4 text-gray-400" />
            </span>
          );
        }
        return (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors',
              p === page
                ? 'bg-brand-yellow text-brand-black'
                : 'text-gray-600 hover:bg-gray-100'
            )}
            aria-current={p === page ? 'page' : undefined}
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
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
