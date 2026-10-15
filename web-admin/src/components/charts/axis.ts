import { format, parseISO } from 'date-fns';
import { formatMoney, formatNumber } from '@/lib/format';

export const formatAxisDate = (dateStr: string): string => {
  try {
    return format(parseISO(dateStr), 'dd.MM');
  } catch {
    return dateStr;
  }
};

/** Compact axis label: 1 200 000 → "1.2 mln". */
export const formatCompact = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${formatNumber(value / 1_000_000, abs >= 10_000_000 ? 0 : 1)} mln`;
  if (abs >= 1_000) return `${formatNumber(value / 1_000, 0)} ming`;
  return formatNumber(value);
};

export const formatTooltipMoney = (value: number): string => formatMoney(value);
