// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { cn } from './cn';
import { formatMoney } from '@/lib/format';

export interface MoneyTextProps {
  value: number | string | null | undefined;
  /** Show the muted " soʻm" suffix (default true). */
  currency?: boolean;
  /** "+" for positive, red for negative — ledgers. */
  signed?: boolean;
  approx?: boolean;
  className?: string;
}

/** "43 500 soʻm" — sans + tabular figures, unit muted and smaller. Never mono. */
export function MoneyText({ value, currency = true, signed = false, approx = false, className }: MoneyTextProps) {
  const amount = formatMoney(value, { currency: false, signed });
  if (amount === '—') return <span className={cn('text-subtle', className)}>—</span>;
  const negative = signed && amount.startsWith('-');
  return (
    <span className={cn('num whitespace-nowrap', negative && 'text-danger-dark dark:text-danger-light', className)}>
      {approx && '~'}
      {amount}
      {currency && <span className="ml-1 text-[0.85em] font-normal text-muted">soʻm</span>}
    </span>
  );
}
