'use client';

import { X } from 'lucide-react';

/**
 * Removable applied-filter chip — active criteria stays visible above the
 * table, because hidden filters are how an operator ends up swearing the
 * data is wrong (data-tables.md).
 */
export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full border border-mint/40 bg-mint-tint text-xs font-medium text-primary-text">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${label} filtrini olib tashlash`}
        className="h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
      >
        <X size={11} />
      </button>
    </span>
  );
}
