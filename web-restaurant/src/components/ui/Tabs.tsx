'use client';

import { useRef } from 'react';
import { clsx } from 'clsx';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string = string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Skrinrider uchun ro'yxat nomi ("Menyu kategoriyalari"). */
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * WAI-ARIA tab naqshi: faqat faol tab tab-tartibida turadi (roving
 * tabindex), qolganlariga ← → Home End bilan o'tiladi.
 */
export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const focusAt = (index: number) => {
    const next = items[(index + items.length) % items.length];
    if (!next) return;
    onChange(next.value);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[(index + items.length) % items.length]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusAt(items.length - 1);
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={clsx(
        'inline-flex items-center gap-1 rounded-ds-sm border border-line bg-surface-2/60 p-1',
        'overflow-x-auto no-scrollbar max-w-full',
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
            id={`tab-${item.value}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onClick={() => onChange(item.value)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-ds-xs font-bold whitespace-nowrap',
              'transition-colors duration-fast ease-standard',
              size === 'sm' ? 'px-3 py-1.5 text-caption' : 'px-3.5 py-2 text-label',
              // Faol tab — INTERAKTIV qatlam: to'q yashil fon + oq matn.
              active
                ? 'bg-primary text-white dark:bg-primary-on-dark'
                : 'text-muted hover:text-ink hover:bg-surface-3'
            )}
          >
            {item.label}
            {item.count != null && (
              <span
                className={clsx(
                  'font-mono text-micro px-1.5 py-px rounded-full tabular-nums',
                  active ? 'bg-white/20 text-white' : 'bg-surface-3 text-muted'
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
