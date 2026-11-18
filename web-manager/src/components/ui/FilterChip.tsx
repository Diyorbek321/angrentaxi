// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { X } from 'lucide-react';
import { cn } from './cn';
import { kitT } from '@/lib/i18n/kit-messages';

export interface FilterChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
}

/**
 * One removable applied-filter chip. Active criteria stay visible above the
 * table — hidden filters are how an operator ends up swearing the data is
 * wrong. Neutral (not mint): a filter is not a status.
 */
export function FilterChip({ label, onRemove, className }: FilterChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 h-6 pl-2 pr-0.5 rounded-ds-sm border border-line bg-surface-2',
        'text-xs font-medium text-ink max-w-[16rem]',
        className
      )}
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={kitT().filters.remove(label)}
        className="h-5 w-5 shrink-0 inline-flex items-center justify-center rounded-ds-xs text-muted hover:text-ink hover:bg-surface-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}
