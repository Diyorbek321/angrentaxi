// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { cn } from './cn';
import { FilterChip as Chip } from './FilterChip';
import { kitT } from '@/lib/i18n/kit-messages';

/** Data shape of one applied filter (web-admin / web-market `type FilterChip`). */
export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface FilterChipsProps {
  chips: FilterChip[];
  onClearAll?: () => void;
  className?: string;
}

/** Row of applied-filter chips + "Filtrlarni tozalash". Renders nothing when empty. */
export function FilterChips({ chips, onClearAll, className }: FilterChipsProps) {
  if (chips.length === 0) return null;
  return (
    <div role="group" aria-label={kitT().filters.active} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {chips.map((c) => (
        <Chip key={c.key} label={c.label} onRemove={c.onRemove} />
      ))}
      {onClearAll && chips.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="h-6 px-1.5 rounded-ds-xs text-xs font-medium text-muted hover:text-ink hover:bg-surface-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {kitT().common.clearFilters}
        </button>
      )}
    </div>
  );
}
