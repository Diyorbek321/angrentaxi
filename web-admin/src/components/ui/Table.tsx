// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from './cn';

/*
 * Low-level table primitives (web-admin API). For a full list screen with
 * sort / selection / states, use DataTable — it is built on these.
 * Density: 40px rows, 13px text, sticky header, hairline dividers.
 */

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  stickyHeader?: boolean;
  containerClassName?: string;
  /** 32px rows. */
  compact?: boolean;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, stickyHeader = false, compact = false, ...props }, ref) => (
    <div
      // Focusable so keyboard users can scroll a wide table horizontally.
      tabIndex={0}
      className={cn(
        'relative w-full overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
        stickyHeader && 'overflow-y-auto',
        containerClassName
      )}
    >
      <table
        ref={ref}
        data-compact={compact || undefined}
        data-sticky={stickyHeader || undefined}
        className={cn('group/table w-full caption-bottom text-[13px] border-collapse', className)}
        {...props}
      />
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(
        'bg-surface-2/60 [&_tr]:border-b [&_tr]:border-line',
        'group-data-[sticky]/table:sticky group-data-[sticky]/table:top-0 group-data-[sticky]/table:z-10',
        'group-data-[sticky]/table:bg-surface-2 group-data-[sticky]/table:shadow-[0_1px_0_rgb(var(--line))]',
        className
      )}
      {...props}
    />
  )
);
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  )
);
TableBody.displayName = 'TableBody';

export const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn('border-t border-line bg-surface-2/50 font-medium', className)} {...props} />
  )
);
TableFooter.displayName = 'TableFooter';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-line transition-colors hover:bg-surface-2/50',
        'data-[state=selected]:bg-mint-tint/60',
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      scope="col"
      className={cn(
        'h-10 group-data-[compact]/table:h-8 px-3 first:pl-4 last:pr-4 text-left align-middle whitespace-nowrap',
        'text-[11px] font-semibold uppercase tracking-[0.04em] text-muted',
        className
      )}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        'h-10 group-data-[compact]/table:h-8 px-3 first:pl-4 last:pr-4 py-1.5 align-middle text-ink',
        className
      )}
      {...props}
    />
  )
);
TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-3 text-xs text-muted', className)} {...props} />
  )
);
TableCaption.displayName = 'TableCaption';
