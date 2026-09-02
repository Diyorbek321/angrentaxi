'use client';

import { useEffect, useState } from 'react';
import { RotateCw, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './Button';

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

function relativeLabel(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return 'hozirgina yangilandi';
  if (s < 60) return `${s} soniya oldin yangilandi`;
  const m = Math.floor(s / 60);
  return `${m} daqiqa oldin yangilandi`;
}

export interface PollStatusProps {
  /** useAsyncData'dan keladigan oxirgi muvaffaqiyatli yuklanish vaqti. */
  lastUpdatedAt: number | null;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  className?: string;
}

/**
 * Polling halolligi (vendor-panels): panel qaysi sur'atda yangilanayotganini
 * yashirmaydi — "N soniya oldin yangilandi" + qo'lda yangilash tugmasi.
 * Sekundlik hisoblagich faqat shu komponentni qayta chizadi, so'rov yubormaydi.
 */
export function PollStatus({ lastUpdatedAt, isRefreshing, onRefresh, className }: PollStatusProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={clsx('inline-flex items-center gap-2', className)}>
      {lastUpdatedAt != null && (
        <span className="text-caption text-subtle whitespace-nowrap tabular-nums hidden sm:inline">
          {relativeLabel(lastUpdatedAt, now)}
        </span>
      )}
      <button
        type="button"
        onClick={onRefresh}
        aria-label="Ma'lumotni hozir yangilash"
        title="Ma'lumotni hozir yangilash"
        className="h-10 w-10 inline-flex items-center justify-center rounded-ds-sm border border-line text-muted hover:bg-surface-2 hover:text-ink transition-colors duration-fast"
      >
        <RotateCw className={clsx('h-4 w-4', isRefreshing && 'animate-spin')} aria-hidden />
      </button>
    </div>
  );
}

export interface StaleDataBannerProps {
  /** Fon yangilanishidagi xato matni; null bo'lsa banner chizilmaydi. */
  error: string | null;
  lastUpdatedAt: number | null;
  onRetry: () => void | Promise<void>;
  isRetrying?: boolean;
  className?: string;
}

/**
 * Aloqa uzilgan, lekin oxirgi yaxshi ma'lumot ekranda qoladi — u O'CHIRILMAYDI,
 * faqat "shu vaqt holaticha" deb belgilanadi. Jim eskirgan ma'lumot —
 * operator ishonchini bir marta yo'qotadigan xato.
 */
export function StaleDataBanner({ error, lastUpdatedAt, onRetry, isRetrying, className }: StaleDataBannerProps) {
  if (!error) return null;

  return (
    <div
      role="status"
      className={clsx(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-ds-sm border border-override/45 bg-override-tint px-3.5 py-2.5',
        className
      )}
    >
      <WifiOff size={16} className="shrink-0 text-override-dark dark:text-override-light" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-label text-override-dark dark:text-override-light">
          Aloqa uzildi — yangilanish muvaffaqiyatsiz
        </p>
        <p className="text-caption text-muted">
          {lastUpdatedAt != null
            ? `Ekrandagi ma'lumot ${formatClock(lastUpdatedAt)} holaticha. `
            : ''}
          {error}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry} isLoading={isRetrying}>
        Qayta urinish
      </Button>
    </div>
  );
}
