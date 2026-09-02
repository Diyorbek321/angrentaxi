'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

function ageLabel(seconds: number): string {
  if (seconds < 10) return 'hozirgina yangilandi';
  if (seconds < 60) return `${seconds} soniya oldin yangilandi`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} daqiqa oldin yangilandi`;
}

/**
 * Poll halolligi: panel 30 soniyada bir yangilanadi va BUNI YASHIRMAYDI —
 * "N soniya oldin yangilandi" yozuvi + qo'lda yangilash tugmasi. Ma'lumot
 * qachonligini bilgan operator unga ishonadi; bilmagani "jonli" deb o'ylaydi.
 */
export function PollingStatus({
  lastUpdated,
  failed,
  refreshing,
  onRefresh,
}: {
  lastUpdated: Date | null;
  failed: boolean;
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  // 5 soniyalik tik — yozuvni yangilab turadi; butun layout emas, faqat shu
  // kichik komponent qayta chiziladi.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const seconds = lastUpdated
    ? Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000))
    : null;

  const label = failed
    ? 'aloqa uzildi'
    : seconds === null
      ? 'yuklanmoqda…'
      : ageLabel(seconds);

  return (
    <div className="flex items-center gap-1.5">
      <span
        aria-hidden
        className={clsx(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          // mint-deep — yorug' fonda ko'rinadigan mint; xato holatda danger.
          failed ? 'bg-danger' : 'bg-mint-deep'
        )}
      />
      <span
        className="hidden whitespace-nowrap font-mono text-caption tabular-nums text-muted sm:inline"
        aria-live="polite"
      >
        {label}
      </span>
      <button
        type="button"
        onClick={() => void onRefresh()}
        disabled={refreshing}
        aria-label="Ma'lumotlarni yangilash"
        title="Yangilash"
        className="flex h-10 w-10 items-center justify-center rounded-ds-xs border border-line text-muted transition-colors duration-fast hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
      >
        <RefreshCw size={15} aria-hidden className={clsx(refreshing && 'motion-safe:animate-spin')} />
      </button>
    </div>
  );
}
