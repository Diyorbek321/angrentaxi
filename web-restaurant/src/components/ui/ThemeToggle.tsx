'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { clsx } from 'clsx';
import { applyTheme, getAppliedTheme, type Theme } from '@/lib/theme';

/**
 * Temani <head> dagi inline skript hidratsiyadan oldin qo'yadi (lib/theme.ts).
 * Bu komponent uni faqat aks ettiradi va almashtiradi — render paytida
 * localStorage O'QIMAYDI, aks holda server va klient chiqishi farq qiladi.
 * Mount bo'lgunicha o'zgarmas ikonka chiziladi, shunda ikkala o'tish mos keladi.
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

  const label = theme === 'dark' ? "Yorug' rejimga o'tish" : "Qorong'i rejimga o'tish";

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === null ? 'Mavzu' : label}
      aria-label={theme === null ? 'Mavzu' : label}
      className={clsx(
        'h-10 w-10 inline-flex items-center justify-center rounded-ds-sm border border-line',
        'text-muted hover:text-ink hover:bg-surface-2 transition-colors duration-fast',
        className
      )}
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
