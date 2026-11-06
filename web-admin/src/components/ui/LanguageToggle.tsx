// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { cn } from './cn';
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n/core';
import { useOptionalLocale } from '@/lib/i18n/I18nProvider';

/**
 * UZ | RU almashtirgich. Topbar'da va login sahifasida turadi.
 * Yorliqlar har doim o'z tilida ("Oʻzbekcha", "Русский") — tilni
 * bilmagan odam ham o'zinikini topishi uchun.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const ctx = useOptionalLocale();
  // Outside <I18nProvider> there is nothing to switch — render nothing rather than crash.
  if (!ctx) return null;
  const { locale, setLocale } = ctx;

  return (
    <div
      role="group"
      aria-label="Til / Язык"
      className={cn('inline-flex items-center gap-0.5 p-0.5 rounded-ds-sm border border-line bg-surface-2', className)}
    >
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            onClick={() => setLocale(l)}
            aria-pressed={active}
            title={LOCALE_LABELS[l].name}
            className={cn(
              'h-6 px-2 rounded-ds-xs text-[11px] font-semibold tracking-wide transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              active ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
            )}
          >
            {LOCALE_LABELS[l].short}
          </button>
        );
      })}
    </div>
  );
}
