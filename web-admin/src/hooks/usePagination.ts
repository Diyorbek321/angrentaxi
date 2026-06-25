'use client';

import { useState, useCallback } from 'react';
import { PAGE_SIZE } from '@/lib/constants';

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginationControls {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  setTotal: (total: number, totalPages: number) => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setLimit: (limit: number) => void;
  reset: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  pageRange: number[];
}

export function usePagination(initialLimit = PAGE_SIZE): PaginationControls {
  const [state, setState] = useState<PaginationState>({
    page: 1,
    limit: initialLimit,
    total: 0,
    totalPages: 1,
  });

  const setTotal = useCallback((total: number, totalPages: number) => {
    setState((prev) => ({ ...prev, total, totalPages }));
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, state.totalPages));
      setState((prev) => ({ ...prev, page: clamped }));
    },
    [state.totalPages]
  );

  const nextPage = useCallback(() => {
    setState((prev) => ({
      ...prev,
      page: Math.min(prev.page + 1, prev.totalPages),
    }));
  }, []);

  const prevPage = useCallback(() => {
    setState((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setState((prev) => ({ ...prev, limit, page: 1 }));
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({ ...prev, page: 1 }));
  }, []);

  // Build a sensible page range for pagination UI (max 7 items)
  const pageRange = buildPageRange(state.page, state.totalPages);

  return {
    ...state,
    setTotal,
    goToPage,
    nextPage,
    prevPage,
    setLimit,
    reset,
    canGoNext: state.page < state.totalPages,
    canGoPrev: state.page > 1,
    pageRange,
  };
}

function buildPageRange(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: number[] = [];
  pages.push(1);
  if (current > 3) pages.push(-1); // ellipsis
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push(-2); // ellipsis
  pages.push(total);
  return pages;
}
