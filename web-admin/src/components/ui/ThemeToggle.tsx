'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyTheme, getAppliedTheme, type Theme } from '@/lib/theme';

/**
 * The theme itself is applied before hydration by the inline script in
 * app/layout.tsx. This component only mirrors and flips it — it must never
 * read localStorage during render, or the server/client output diverges.
 * Until mounted it renders a fixed placeholder icon so both passes match.
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
        'h-9 w-9 inline-flex items-center justify-center rounded-ds-sm border border-line',
        'text-muted hover:text-ink hover:bg-surface-2 transition-colors duration-fast',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        className
      )}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
