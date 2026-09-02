'use client';

import { useEffect, useMemo, useState } from 'react';

export interface Paged<T> {
  pageItems: T[];
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  /** "1–25 / 118" ko'rinishidagi diapazon yozuvi. */
  rangeLabel: string;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

/**
 * Klient tomonidagi sahifalash (admin jadval qoidasi: pagination, infinite
 * scroll emas). Filtr o'zgarib ro'yxat qisqarsa, joriy sahifa avtomatik
 * chegaraga qaytariladi — "bo'sh 4-sahifa" holati bo'lmaydi.
 */
export function usePagination<T>(items: T[], initialPageSize = 25): Paged<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const safePage = Math.min(page, pageCount);

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return {
    pageItems,
    page: safePage,
    pageCount,
    pageSize,
    total,
    rangeLabel: `${from}–${to} / ${total}`,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
  };
}
