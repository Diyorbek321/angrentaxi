'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { clsx } from 'clsx';
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

  const label = theme === 'dark' ? 'Yorug‘ rejimga o‘tish' : 'Qorong‘i rejimga o‘tish';

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === null ? 'Mavzu' : label}
      aria-label={theme === null ? 'Mavzu' : label}
      className={clsx(
        'h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line',
        'text-muted hover:text-ink hover:bg-surface-2 transition-colors',
        className
      )}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
