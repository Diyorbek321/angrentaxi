import { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Thin styled wrappers over the native table elements. Not a data-grid — the
 * pages own their columns; this only keeps borders, spacing and the sticky
 * header identical everywhere.
 */

export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className={cn('w-full text-sm border-collapse', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('bg-surface-2 sticky top-0 z-10', className)} {...props}>
      {children}
    </thead>
  );
}

export function TBody({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-line', className)} {...props}>
      {children}
    </tbody>
  );
}

export interface TRProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Row-level attention accent — low stock, out of stock. */
  tone?: 'default' | 'warn' | 'danger';
  interactive?: boolean;
}

const rowTone: Record<NonNullable<TRProps['tone']>, string> = {
  default: '',
  warn: 'bg-warn/[0.06]',
  danger: 'bg-danger/[0.06]',
};

export function TR({ tone = 'default', interactive, className, children, ...props }: TRProps) {
  return (
    <tr
      className={cn(
        'transition-colors',
        rowTone[tone],
        interactive && 'hover:bg-surface-2 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
}

export function TH({ align = 'left', className, children, ...props }: THProps) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-2xs font-semibold uppercase tracking-wide text-subtle whitespace-nowrap',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
  /** Numbers, prices, ids — mono so columns line up. */
  mono?: boolean;
}

export function TD({ align = 'left', mono, className, children, ...props }: TDProps) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-ink align-middle',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        mono && 'font-mono tabular-nums',
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}
