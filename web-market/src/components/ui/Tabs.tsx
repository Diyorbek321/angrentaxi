// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `underline` = in-page sections (default); `segmented` = compact filter switch. */
  variant?: 'underline' | 'segmented';
  /** `lg` = 40px touch targets (kitchen / tablet screens). */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Stretch items to fill the row (no horizontal scroll). Labels are never
   * ellipsized: when the row is too narrow the items wrap onto a second row
   * and each row stretches to the full width.
   */
  fullWidth?: boolean;
  /** Accessible name of the tab list (alias: `label`). */
  ariaLabel?: string;
  label?: string;
  className?: string;
}

/** Roving focus: arrows / Home / End move between enabled tabs. */
function useRovingKeys<T extends string>(items: readonly TabItem<T>[], value: T, onChange: (v: T) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.value === value);
    let next: TabItem<T> | undefined;
    if (e.key === 'ArrowRight') next = enabled[(idx + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    onChange(next.value);
    const pos = items.indexOf(next);
    requestAnimationFrame(() => ref.current?.querySelectorAll<HTMLElement>('[role="tab"]')[pos]?.focus());
  };
  return { ref, onKeyDown };
}

function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={cn(
        'num min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-ds-xs text-[11px] font-medium',
        active ? 'bg-surface-3 text-ink' : 'bg-surface-2 text-muted'
      )}
    >
      {n}
    </span>
  );
}

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  variant = 'underline',
  size = 'md',
  fullWidth = false,
  ariaLabel,
  label,
  className,
}: TabsProps<T>) {
  const { ref, onKeyDown } = useRovingKeys(items, value, onChange);
  const segmented = variant === 'segmented';

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={ariaLabel ?? label}
      onKeyDown={onKeyDown}
      className={cn(
        fullWidth ? 'w-full' : 'max-w-full overflow-x-auto no-scrollbar',
        segmented
          ? cn(
              fullWidth ? 'flex flex-wrap' : 'inline-flex',
              'items-center gap-0.5 p-0.5 rounded-ds-sm border border-line bg-surface-2'
            )
          : cn('flex items-center gap-4 border-b border-line', fullWidth && 'flex-wrap gap-y-0'),
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
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40',
              size === 'lg' ? '[&_svg]:h-4 [&_svg]:w-4' : '[&_svg]:h-3.5 [&_svg]:w-3.5',
              fullWidth && 'flex-auto justify-center',
              segmented
                ? cn(
                    'rounded-[5px]',
                    size === 'sm' ? 'h-6 px-2.5 text-xs' : size === 'lg' ? 'h-10 px-3.5 text-sm' : 'h-7 px-2.5 text-[13px]',
                    active ? 'bg-surface text-ink shadow-hairline' : 'text-muted hover:text-ink'
                  )
                : cn(
                    'relative -mb-px border-b-2 px-0.5',
                    size === 'sm' ? 'h-8 text-[13px]' : size === 'lg' ? 'h-11 text-[15px]' : 'h-9 text-sm',
                    active ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink'
                  )
            )}
          >
            {item.icon}
            {item.label}
            {item.count != null && <Count n={item.count} active={active} />}
          </button>
        );
      })}
    </div>
  );
}
