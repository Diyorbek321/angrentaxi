'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string = string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  /** Ekran o'quvchi uchun tablist nomi. */
  ariaLabel?: string;
}

/**
 * Klaviatura: ←/→ qo'shni tabga, Home/End chetlariga o'tadi (WAI-ARIA tabs
 * naqshi). Faol bo'lmagan tablar `tabIndex={-1}` — Tab tugmasi butun
 * ro'yxatga bir marta tushadi, har bir tabga alohida emas.
 */
export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  className,
  size = 'md',
  ariaLabel,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const focusTab = (index: number) => {
    const next = items[(index + items.length) % items.length];
    onChange(next.value);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[(index + items.length) % items.length]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusTab(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusTab(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusTab(items.length - 1);
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-ds-md border border-line bg-surface-2/60 p-1',
        className
      )}
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-ds-sm font-medium transition-colors duration-fast',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              size === 'sm' ? 'px-2.5 py-1 text-caption' : 'px-3 py-1.5 text-body',
              active
                ? 'border border-line bg-surface text-ink shadow-card'
                : 'border border-transparent text-muted hover:text-ink'
            )}
          >
            {item.label}
            {item.count != null && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px font-mono text-[11px]',
                  active ? 'bg-mint-tint text-primary-text' : 'bg-surface-3 text-muted'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
