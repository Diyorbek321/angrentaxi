'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface FilterChipsProps {
  chips: FilterChip[];
  onClearAll: () => void;
  className?: string;
}

/**
 * Qo'llangan filtrlar jadval USTIDA ko'rinadigan, olib tashlanadigan chiplar
 * sifatida turadi — yashirin faol filtr operatorning "ma'lumot noto'g'ri"
 * deb qasam ichishining klassik sababi. Har bir chip alohida olinadi,
 * "Hammasini tozalash" bittada.
 */
export function FilterChips({ chips, onClearAll, className }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} aria-label="Faol filtrlar">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint-tint py-1 pl-3 pr-1.5 text-caption font-semibold text-primary-text"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`${chip.label} filtrini olib tashlash`}
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-fast',
              'hover:bg-mint/20',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-bg'
            )}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className={cn(
          'rounded-ds-xs px-2 py-1 text-caption font-semibold text-muted underline-offset-2',
          'transition-colors duration-fast hover:text-ink hover:underline',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
        )}
      >
        Hammasini tozalash
      </button>
    </div>
  );
}
