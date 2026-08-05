'use client';

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
  className?: string;
  size?: 'sm' | 'md';
}

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  className,
  size = 'md',
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={clsx(
        'inline-flex items-center gap-1 rounded-xl border border-line bg-surface-2/60 p-1 overflow-x-auto no-scrollbar max-w-full',
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors whitespace-nowrap',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active
                ? 'bg-surface text-ink shadow-card border border-line'
                : 'text-muted hover:text-ink border border-transparent'
            )}
          >
            {item.label}
            {item.count != null && (
              <span
                className={clsx(
                  'font-mono text-[11px] px-1.5 py-px rounded-full',
                  active ? 'bg-primary/15 text-primary-700 dark:text-primary-300' : 'bg-surface-3 text-muted'
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
