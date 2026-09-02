'use client';

import type { ProductStatus } from '@/lib/api';
import { Button } from '@/components/ui/Button';

/**
 * Tanlov paneli: nechta tanlangani + amal QAMROVI so'z bilan yozilgan.
 * Tanlov bo'lmasa umuman ko'rinmaydi — doimiy turgan bo'sh toolbar
 * operatorni signalga befarq qilib qo'yadi.
 */
export function BulkToolbar({
  count,
  busy,
  onSetStatus,
  onOpenPrice,
  onClear,
}: {
  count: number;
  busy: boolean;
  onSetStatus: (status: ProductStatus) => void;
  onOpenPrice: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div
      role="group"
      aria-label="Tanlanganlar uchun amallar"
      className="mb-4 flex flex-wrap items-center gap-2.5 rounded-ds-sm border border-mint/30 bg-mint-tint px-3.5 py-2"
    >
      <span className="text-caption font-bold text-primary-text">{count} ta tanlandi</span>
      <span className="hidden text-caption text-muted sm:inline">
        Amallar faqat tanlanganlarga qo&apos;llanadi
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" isLoading={busy} onClick={() => onSetStatus('active')}>
          Faollashtirish
        </Button>
        <Button size="sm" variant="secondary" isLoading={busy} onClick={() => onSetStatus('hidden')}>
          Yashirish
        </Button>
        <Button size="sm" variant="secondary" onClick={onOpenPrice}>
          Narxni o&apos;zgartirish
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Bekor qilish
        </Button>
      </div>
    </div>
  );
}
