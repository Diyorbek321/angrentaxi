// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from './cn';
import { applyTheme, getAppliedTheme, type Theme } from '@/lib/theme';

/**
 * Mirrors and flips the theme the pre-paint script in app/layout.tsx applied.
 * Never reads localStorage during render; renders a fixed icon until mounted.
 * Each panel's `@/lib/theme` owns its own storage key.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(getAppliedTheme());
  }, []);

  const toggle = () => {
    const next: Theme = getAppliedTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  const label = theme === 'dark' ? 'Yorugʻ rejimga oʻtish' : 'Qorongʻi rejimga oʻtish';

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === null ? 'Mavzu' : label}
      aria-label={theme === null ? 'Mavzu' : label}
      className={cn(
        'h-8 w-8 inline-flex items-center justify-center rounded-ds-sm text-muted',
        'hover:text-ink hover:bg-surface-2 transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        className
      )}
    >
      {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
}
