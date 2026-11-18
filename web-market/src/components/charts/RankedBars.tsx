import { formatNumber } from '@/lib/format';

export interface RankedBarItem {
  label: string;
  value: number;
  /** Matn ko'rinishi (masalan "12 500 soʻm"); berilmasa son. */
  display?: string;
}

/**
 * Gorizontal reyting chiziqlari: uzunlik ENG KATTA qiymatga nisbatan
 * (birinchi elementga emas — ro'yxat tartiblanmagan bo'lsa ham to'g'ri).
 * Donut/pie emas: miqdor uzunlik bilan kodlanadi (PANEL-UI-KIT §6).
 */
export function RankedBars({ items, unit, ariaLabel }: { items: RankedBarItem[]; unit?: string; ariaLabel: string }) {
  const max = items.reduce((m, i) => Math.max(m, i.value), 0);
  return (
    <ol aria-label={ariaLabel} className="space-y-3">
      {items.map((item, i) => {
        const pct = max > 0 ? Math.max(2, Math.round((item.value / max) * 100)) : 0;
        const text = item.display ?? `${formatNumber(item.value)}${unit ? ` ${unit}` : ''}`;
        return (
          <li key={`${item.label}-${i}`} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
            <span className="num text-xs text-subtle">{i + 1}</span>
            <span className="truncate text-[13px] text-ink" title={item.label}>
              {item.label}
            </span>
            <span className="num text-[13px] font-medium text-ink">{text}</span>
            <span aria-hidden />
            <span aria-hidden className="col-span-2 h-1.5 rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-primary dark:bg-mint-deep" style={{ width: `${pct}%` }} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
