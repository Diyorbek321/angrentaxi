'use client';

import { cn } from '@/lib/utils';

/**
 * Products have no image field — the catalog is rendered from `emoji` + `hue`
 * instead. So picking the right emoji *is* picking the product photo, and it
 * deserves better than a bare text input.
 */
const EMOJI_GROUPS: Array<{ label: string; emojis: string[] }> = [
  {
    label: 'Oziq-ovqat',
    emojis: ['🍞', '🥖', '🥐', '🧀', '🥚', '🥛', '🧈', '🍚', '🍝', '🫘', '🧂', '🍯'],
  },
  {
    label: 'Meva-sabzavot',
    emojis: ['🍎', '🍌', '🍇', '🍉', '🍓', '🍋', '🥔', '🥕', '🧅', '🥬', '🍅', '🥒'],
  },
  {
    label: 'Go‘sht va baliq',
    emojis: ['🥩', '🍗', '🥓', '🐟', '🍤', '🌭', '🍖', '🥫'],
  },
  {
    label: 'Ichimlik',
    emojis: ['💧', '🥤', '🧃', '☕', '🍵', '🥤', '🍶', '🧉'],
  },
  {
    label: 'Boshqa',
    emojis: ['🧴', '🧻', '🧼', '🪥', '🧹', '🔋', '💊', '🛒'],
  },
];

export interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  /** Existing product's hue. Omitted for new products — the backend assigns one. */
  hue?: number;
}

export function EmojiPicker({ value, onChange, hue }: EmojiPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted">Belgi (mahsulot rasmi o‘rniga)</span>

      <div className="flex items-center gap-3">
        <span
          className="h-12 w-12 shrink-0 rounded-xl border border-line bg-surface-2 flex items-center justify-center text-2xl"
          aria-hidden
        >
          {value || '🛒'}
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 4))}
          maxLength={4}
          aria-label="Belgi"
          placeholder="🛒"
          className="w-20 text-center bg-surface border border-line rounded-lg px-2 py-2 text-lg text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
        />
        <p className="text-xs text-subtle leading-snug">
          Ro‘yxatdan tanlang yoki o‘zingiz kiriting.
          <br />
          Fon rangi {hue === undefined ? 'avtomatik beriladi' : `belgilangan (${hue}°)`}.
        </p>
      </div>

      <div className="max-h-40 overflow-y-auto rounded-lg border border-line bg-surface-2/50 p-2 space-y-2">
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-2xs font-semibold uppercase tracking-wide text-subtle mb-1 px-0.5">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-1">
              {group.emojis.map((emoji, i) => (
                <button
                  key={`${group.label}-${emoji}-${i}`}
                  type="button"
                  onClick={() => onChange(emoji)}
                  aria-label={emoji}
                  aria-pressed={value === emoji}
                  className={cn(
                    'h-8 w-8 rounded-lg text-lg flex items-center justify-center transition-colors',
                    value === emoji
                      ? 'bg-primary/15 ring-1 ring-primary/45'
                      : 'hover:bg-surface-3'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
