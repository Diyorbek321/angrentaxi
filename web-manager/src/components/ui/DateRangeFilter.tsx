// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { format, subDays } from 'date-fns';
import { cn } from './cn';
import { Input } from './Input';

export type DatePreset = 'today' | '7d' | '30d' | 'custom';

export interface DateRangeValue {
  preset: DatePreset | null;
  /** yyyy-MM-dd */
  from: string | null;
  /** yyyy-MM-dd */
  to: string | null;
}

export const EMPTY_DATE_RANGE: DateRangeValue = { preset: null, from: null, to: null };

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Bugun',
  '7d': '7 kun',
  '30d': '30 kun',
  custom: 'Oraliq',
};

const ISO = 'yyyy-MM-dd';

export function rangeForPreset(preset: Exclude<DatePreset, 'custom'> | DatePreset): { from: string; to: string } {
  const today = new Date();
  const to = format(today, ISO);
  if (preset === 'today') return { from: to, to };
  if (preset === '7d') return { from: format(subDays(today, 6), ISO), to };
  if (preset === '30d') return { from: format(subDays(today, 29), ISO), to };
  return { from: format(subDays(today, 6), ISO), to };
}

export interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Which presets to offer (default all four). */
  presets?: DatePreset[];
  className?: string;
}

/**
 * Segmented presets (Bugun / 7 kun / 30 kun / Oraliq). Clicking the active
 * preset clears it. "Oraliq" reveals two linked date inputs.
 */
export function DateRangeFilter({
  value,
  onChange,
  presets = ['today', '7d', '30d', 'custom'],
  className,
}: DateRangeFilterProps) {
  const pick = (p: DatePreset) => {
    if (value.preset === p) {
      onChange(EMPTY_DATE_RANGE);
      return;
    }
    if (p === 'custom') {
      const base = value.from && value.to ? { from: value.from, to: value.to } : rangeForPreset('7d');
      onChange({ preset: 'custom', ...base });
      return;
    }
    onChange({ preset: p, ...rangeForPreset(p) });
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div
        role="group"
        aria-label="Sana oraligʻi"
        className="inline-flex items-center gap-0.5 p-0.5 rounded-ds-sm border border-line bg-surface-2"
      >
        {presets.map((p) => {
          const active = value.preset === p;
          return (
            <button
              key={p}
              type="button"
              aria-pressed={active}
              onClick={() => pick(p)}
              className={cn(
                'h-7 px-2.5 rounded-[5px] text-[13px] font-medium whitespace-nowrap transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                active ? 'bg-surface text-ink shadow-hairline' : 'text-muted hover:text-ink'
              )}
            >
              {DATE_PRESET_LABELS[p]}
            </button>
          );
        })}
      </div>
      {value.preset === 'custom' && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label="Boshlanish sanasi"
            value={value.from ?? ''}
            max={value.to ?? undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value || null })}
            className="w-[9.5rem]"
          />
          <span className="text-subtle" aria-hidden>
            –
          </span>
          <Input
            type="date"
            aria-label="Tugash sanasi"
            value={value.to ?? ''}
            min={value.from ?? undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value || null })}
            className="w-[9.5rem]"
          />
        </div>
      )}
    </div>
  );
}
