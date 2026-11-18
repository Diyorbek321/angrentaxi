// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from './cn';
import { Checkbox } from './Checkbox';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Pagination, type PaginationProps } from './Pagination';
import { RetryBanner } from './RetryBanner';
import { Skeleton } from './Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table';
import { kitT } from '@/lib/i18n/kit-messages';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** Numbers/money: right-aligned + tabular figures. */
  numeric?: boolean;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  /** Tailwind width class, e.g. "w-32". */
  width?: string;
  className?: string;
  headerClassName?: string;
  /**
   * Hide the column below a breakpoint (sm 640, md 768, lg 1024, xl 1280,
   * 2xl 1536). Wide tables must fit 1024px without horizontal scroll:
   * low-priority columns get `xl` (gone at 1024) or `2xl` (gone at 1440).
   * Identity, money and status columns never take this option.
   */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Accessible table name. */
  ariaLabel?: string;

  loading?: boolean;
  /** Error from the last load. With rows → banner above (data kept); without → ErrorState. */
  error?: string | null;
  onRetry?: () => void | Promise<void>;
  /** Props of the in-table empty state (used when nothing is filtered). */
  empty?: EmptyStateProps;
  /**
   * Filters/search are applied: an empty result renders the built-in
   * `no-results` EmptyState ("Hech narsa topilmadi" + "Filtrlarni tozalash")
   * instead of `empty`. Override its copy with `emptyFiltered`.
   */
  isFiltered?: boolean;
  onClearFilters?: () => void;
  emptyFiltered?: Partial<EmptyStateProps>;

  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;

  selectable?: boolean;
  /** Accessible name of a row — selection checkbox reads "Tanlash: {rowLabel}" (kit-messages). */
  rowLabel?: (row: T) => string;
  selectedKeys?: ReadonlySet<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  /** Rendered in the bulk bar when something is selected. */
  bulkActions?: (selected: Set<string>) => ReactNode;

  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  /** 32px rows. */
  compact?: boolean;
  /** Sticky header inside a scroll box of this max height class (e.g. "max-h-[65vh]"). */
  maxHeightClassName?: string;
  pagination?: PaginationProps;
  /** Render inside a Card-like container (default true). */
  bordered?: boolean;
  /** Header row (like CardHeader): 15px title + muted description + right actions. */
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Toolbar row above the table (FilterBar). */
  toolbar?: ReactNode;
  /** Footer row under the table — e.g. "12 ta" for unpaginated client lists. */
  footer?: ReactNode;
  className?: string;
}

const hideClass = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
} as const;

function alignClass(c: { numeric?: boolean; align?: 'left' | 'center' | 'right' }) {
  const a = c.align ?? (c.numeric ? 'right' : 'left');
  return a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';
}

/**
 * The list screen workhorse: sticky header, 40px rows (32 compact), 13px,
 * numeric columns right-aligned, sort, selection + bulk bar, hover, and the
 * loading / empty / error trio rendered INSIDE the table frame.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  ariaLabel,
  loading = false,
  error,
  onRetry,
  empty,
  isFiltered = false,
  onClearFilters,
  emptyFiltered,
  sort,
  onSortChange,
  selectable = false,
  rowLabel,
  selectedKeys,
  onSelectionChange,
  bulkActions,
  onRowClick,
  rowClassName,
  compact = false,
  maxHeightClassName,
  pagination,
  bordered = true,
  title,
  description,
  actions,
  toolbar,
  footer,
  className,
}: DataTableProps<T>) {
  const selected = new Set(selectedKeys ?? []);
  const keys = rows.map(rowKey);
  const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
  const someSelected = !allSelected && keys.some((k) => selected.has(k));
  const colCount = columns.length + (selectable ? 1 : 0);
  const hasRows = rows.length > 0;

  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) keys.forEach((k) => next.delete(k));
    else keys.forEach((k) => next.add(k));
    onSelectionChange?.(next);
  };
  const toggleOne = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onSelectionChange?.(next);
  };

  const cycleSort = (key: string) => {
    if (!onSortChange) return;
    if (!sort || sort.key !== key) onSortChange({ key, direction: 'asc' });
    else if (sort.direction === 'asc') onSortChange({ key, direction: 'desc' });
    else onSortChange(null);
  };

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onRowClick(row);
    }
  };

  let body: ReactNode;
  if (!hasRows && loading) {
    body = Array.from({ length: compact ? 10 : 8 }).map((_, r) => (
      <TableRow key={`sk${r}`} className="hover:bg-transparent">
        {selectable && (
          <TableCell className="w-10">
            <Skeleton className="h-4 w-4 rounded-[4px]" />
          </TableCell>
        )}
        {columns.map((c, i) => (
          <TableCell key={c.key} className={cn(c.hideBelow && hideClass[c.hideBelow])}>
            <Skeleton className={cn('h-3', c.numeric ? 'ml-auto w-16' : ['w-2/3', 'w-1/2', 'w-3/4'][(r + i) % 3])} />
          </TableCell>
        ))}
      </TableRow>
    ));
  } else if (!hasRows && error) {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={colCount}>
          <ErrorState message={error} onRetry={onRetry} compact />
        </TableCell>
      </TableRow>
    );
  } else if (!hasRows) {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={colCount}>
          {isFiltered ? (
            <EmptyState
              compact
              variant="no-results"
              title={kitT().dataTable.noResultsTitle}
              description={kitT().dataTable.noResultsDescription}
              onClearFilters={onClearFilters}
              {...emptyFiltered}
            />
          ) : (
            <EmptyState compact title={kitT().dataTable.emptyTitle} {...empty} />
          )}
        </TableCell>
      </TableRow>
    );
  } else {
    body = rows.map((row, i) => {
      const k = keys[i];
      const isSel = selected.has(k);
      return (
        <TableRow
          key={k}
          data-state={isSel ? 'selected' : undefined}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          onKeyDown={onRowClick ? (e) => onRowKey(e, row) : undefined}
          tabIndex={onRowClick ? 0 : undefined}
          className={cn(
            onRowClick && 'cursor-pointer focus:outline-none focus-visible:bg-surface-2',
            rowClassName?.(row)
          )}
        >
          {selectable && (
            <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSel}
                onCheckedChange={() => toggleOne(k)}
                aria-label={rowLabel ? kitT().dataTable.selectRow(rowLabel(row)) : kitT().dataTable.selectRowGeneric}
              />
            </TableCell>
          )}
          {columns.map((c) => (
            <TableCell
              key={c.key}
              className={cn(alignClass(c), c.numeric && 'num whitespace-nowrap', c.hideBelow && hideClass[c.hideBelow], c.className)}
            >
              {c.cell(row, i)}
            </TableCell>
          ))}
        </TableRow>
      );
    });
  }

  return (
    <div
      className={cn(
        'min-w-0',
        bordered && 'bg-surface border border-line rounded-ds-md overflow-hidden shadow-card',
        className
      )}
    >
      {(title != null || description != null || actions != null) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-line">
          <div className="min-w-0">
            {title != null && <h3 className="text-title text-ink truncate">{title}</h3>}
            {description != null && <div className="text-[13px] text-muted mt-0.5">{description}</div>}
          </div>
          {actions != null && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {toolbar && <div className="px-4 py-3 border-b border-line">{toolbar}</div>}
      {hasRows && error && (
        <RetryBanner
          message={error}
          onRetry={onRetry ?? (() => undefined)}
          keepsLastData
          className="m-3 mb-0"
        />
      )}
      {selectable && selected.size > 0 && (
        <div
          role="region"
          aria-label={kitT().dataTable.bulkRegion}
          className="flex items-center gap-3 h-11 px-4 border-b border-line bg-mint-tint/50"
        >
          <span className="num text-[13px] font-medium text-ink">{kitT().dataTable.selected(selected.size)}</span>
          <div className="flex items-center gap-2">{bulkActions?.(selected)}</div>
          <button
            type="button"
            onClick={() => onSelectionChange?.(new Set())}
            className="ml-auto text-[13px] text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-ds-xs"
          >
            {kitT().common.cancel}
          </button>
        </div>
      )}
      <Table
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        compact={compact}
        stickyHeader={!!maxHeightClassName}
        containerClassName={maxHeightClassName}
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectable && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleAll}
                  aria-label={kitT().dataTable.selectAll}
                  disabled={!hasRows}
                />
              </TableHead>
            )}
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const ariaSort = active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : undefined;
              return (
                <TableHead
                  key={c.key}
                  aria-sort={ariaSort}
                  className={cn(alignClass(c), c.width, c.hideBelow && hideClass[c.hideBelow], c.headerClassName)}
                >
                  {c.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => cycleSort(c.key)}
                      className={cn(
                        'inline-flex items-center gap-1 uppercase tracking-[0.04em] hover:text-ink rounded-ds-xs',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                        active && 'text-ink',
                        alignClass(c) === 'text-right' && 'flex-row-reverse'
                      )}
                    >
                      {c.header}
                      {active ? (
                        sort?.direction === 'asc' ? (
                          <ArrowUp size={12} aria-hidden />
                        ) : (
                          <ArrowDown size={12} aria-hidden />
                        )
                      ) : (
                        <ChevronsUpDown size={12} aria-hidden className="opacity-50" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>{body}</TableBody>
      </Table>
      {pagination && hasRows && <Pagination {...pagination} />}
      {footer != null && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-line text-[13px] text-muted">{footer}</div>
      )}
    </div>
  );
}
