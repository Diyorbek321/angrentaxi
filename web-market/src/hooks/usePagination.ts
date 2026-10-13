'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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

  return {
    pageItems,
    page: safePage,
    pageCount,
    pageSize,
    total,
    rangeLabel: rangeLabel(safePage, pageSize, total),
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
  };
}

/** "1–25 / 118" — server sahifasi uchun ham shu yozuv. */
export function rangeLabel(page: number, pageSize: number, total: number): string {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return `${from}–${to} / ${total}`;
}

export interface ServerPagination {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  /** Serverdan kelgan sahifani `Pagination` komponenti kutgan shaklga o'raydi. */
  toPaged: <T>(items: T[], total: number) => Paged<T>;
}

/**
 * Server tomonidagi sahifalash: holat (sahifa, o'lcham) shu yerda, qatorlarni
 * server beradi. Filtr o'zgarganda chaqiruvchi `setPage(1)` qiladi.
 */
export function useServerPagination(initialPageSize = 25): ServerPagination {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const toPaged = useCallback(
    <T,>(items: T[], total: number): Paged<T> => ({
      pageItems: items,
      page,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      pageSize,
      total,
      rangeLabel: rangeLabel(page, pageSize, total),
      setPage,
      setPageSize,
    }),
    [page, pageSize, setPageSize]
  );

  return { page, pageSize, setPage, setPageSize, toPaged };
}
