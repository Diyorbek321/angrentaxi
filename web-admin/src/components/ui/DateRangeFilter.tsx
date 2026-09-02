'use client';

import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from './Input';

const DATE_FMT = 'yyyy-MM-dd';

export type DatePreset = 'today' | '7d' | '30d' | 'custom';

export interface DateRangeValue {
  preset: DatePreset | null;
  /** yyyy-MM-dd — API'ga `from`/`to` sifatida uzatiladi (reports bilan bir xil format). */
  from: string | null;
  to: string | null;
}

export const EMPTY_DATE_RANGE: DateRangeValue = { preset: null, from: null, to: null };

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Bugun',
  '7d': '7 kun',
  '30d': '30 kun',
  custom: 'Oraliq',
};

export function rangeForPreset(preset: DatePreset): { from: string; to: string } {
  const today = format(new Date(), DATE_FMT);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case '7d':
      return { from: format(subDays(new Date(), 7), DATE_FMT), to: today };
    case '30d':
      return { from: format(subDays(new Date(), 30), DATE_FMT), to: today };
    case 'custom':
      return { from: today, to: today };
  }
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}

/**
 * Sana oralig'i tez-filtrlari: Bugun / 7 kun / 30 kun / Oraliq.
 * Preset ikkinchi bosishda BEKOR bo'ladi (filtr olib tashlanadi) — jadval
 * "hammasi" holatiga qaytadi. "Oraliq" ikkita sana maydonini ochadi.
 */
export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const selectPreset = (preset: DatePreset) => {
    if (value.preset === preset) {
      onChange(EMPTY_DATE_RANGE);
      return;
    }
    const range = rangeForPreset(preset);
    onChange({ preset, from: range.from, to: range.to });
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div
        role="group"
        aria-label="Sana oralig'i"
        className="inline-flex overflow-hidden rounded-ds-sm border border-line"
      >
        {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((preset, idx) => {
          const active = value.preset === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={active}
              onClick={() => selectPreset(preset)}
              className={cn(
                'h-8 px-3 text-caption font-semibold transition-colors duration-fast',
                idx > 0 && 'border-l border-line',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus',
                active
                  ? 'bg-primary text-white dark:bg-primary-on-dark'
                  : 'bg-surface text-muted hover:bg-surface-2 hover:text-ink'
              )}
            >
              {DATE_PRESET_LABELS[preset]}
            </button>
          );
        })}
      </div>

      {value.preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Boshlanish sanasi"
            value={value.from ?? ''}
            max={value.to ?? undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value || null })}
            className="h-8 w-40 px-2 py-1 text-caption"
          />
          <span className="text-caption text-subtle" aria-hidden="true">
            —
          </span>
          <Input
            type="date"
            aria-label="Tugash sanasi"
            value={value.to ?? ''}
            min={value.from ?? undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value || null })}
            className="h-8 w-40 px-2 py-1 text-caption"
          />
        </div>
      )}
    </div>
  );
}
