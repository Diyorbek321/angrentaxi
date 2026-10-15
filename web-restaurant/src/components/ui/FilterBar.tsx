// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import type { ReactNode } from 'react';
import { cn } from './cn';
import { SearchInput } from './SearchInput';
import { FilterChips, type FilterChip } from './FilterChips';

export interface FilterBarProps {
  /** Search box (omit both to hide). */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Accessible name of the search box (defaults to the placeholder). */
  searchAriaLabel?: string;
  /** Custom clear (×) handler; defaults to `onSearchChange('')`. */
  onSearchClear?: () => void;
  /** Width classes of the search box (default `w-full sm:w-72`). */
  searchClassName?: string;
  /** Selects, segmented controls, date range — laid out left to right. */
  children?: ReactNode;
  /** Right side (export, columns…). */
  actions?: ReactNode;
  /** Applied-filter chips shown under the controls. */
  chips?: FilterChip[];
  /** "Filtrlarni tozalash" — shown when anything is applied. */
  onClearAll?: () => void;
  className?: string;
}

/** Search + filters + chips + clear, above a DataTable. */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Qidirish…',
  searchAriaLabel,
  onSearchClear,
  searchClassName = 'w-full sm:w-72',
  children,
  actions,
  chips = [],
  onClearAll,
  className,
}: FilterBarProps) {
  const hasSearch = onSearchChange != null;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {hasSearch && (
          <SearchInput
            value={search ?? ''}
            onChange={onSearchChange}
            onClear={onSearchClear}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
            wrapperClassName={searchClassName}
          />
        )}
        {children}
        {(actions || (onClearAll && chips.length === 0 && (search ?? '') !== '')) && (
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        )}
      </div>
      {chips.length > 0 && <FilterChips chips={chips} onClearAll={onClearAll} />}
    </div>
  );
}
