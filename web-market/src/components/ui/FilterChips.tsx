'use client';

import { X } from 'lucide-react';

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * Qo'llangan filtrlar — olib tashlanadigan chiplar + "Hammasini tozalash".
 * Yashirin faol filtr operatorni "ma'lumot noto'g'ri" degan xulosaga olib
 * boradi; shu qator turgani uchun mezonlar har doim ko'z oldida.
 */
export function FilterChips({
  chips,
  onClearAll,
  className,
}: {
  chips: FilterChip[];
  onClearAll: () => void;
  className?: string;
}) {
  if (chips.length === 0) return null;

  return (
    <div
      role="group"
      aria-label="Qo'llangan filtrlar"
      className={'flex flex-wrap items-center gap-2 ' + (className ?? '')}
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full border border-mint/30 bg-mint-tint py-1 pl-2.5 pr-1 text-caption font-semibold text-primary-text"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`${chip.label} filtrini olib tashlash`}
            onClick={chip.onRemove}
            className="flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-fast hover:bg-mint/25"
          >
            <X size={11} aria-hidden />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-caption font-bold text-muted underline-offset-2 transition-colors duration-fast hover:text-ink hover:underline"
      >
        Hammasini tozalash
      </button>
    </div>
  );
}
