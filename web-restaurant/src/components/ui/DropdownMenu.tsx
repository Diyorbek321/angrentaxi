// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from './cn';
import { Portal } from './Portal';

export type DropdownItem =
  | {
      type?: 'item';
      label: ReactNode;
      icon?: ReactNode;
      onSelect?: () => void;
      href?: string;
      /** Destructive action (red text). */
      danger?: boolean;
      disabled?: boolean;
      /** Right-aligned hint (shortcut, count). */
      hint?: ReactNode;
    }
  | { type: 'separator' }
  | { type: 'label'; label: ReactNode };

export interface DropdownMenuProps {
  /** Render prop gets the props to spread on your trigger button. */
  trigger: (props: {
    ref: (node: HTMLElement | null) => void;
    onClick: () => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
  }) => ReactNode;
  items: DropdownItem[];
  align?: 'start' | 'end';
  side?: 'bottom' | 'top';
  /** Optional header block (e.g. the signed-in user). */
  header?: ReactNode;
  className?: string;
  minWidth?: number;
}

/**
 * Menu for profile and row actions (⋯). Portal-positioned, closes on
 * outside click / Esc / select; arrow keys move focus.
 */
export function DropdownMenu({
  trigger,
  items,
  align = 'end',
  side = 'bottom',
  header,
  className,
  minWidth = 200,
}: DropdownMenuProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerEl = useRef<HTMLElement | null>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => setRect(triggerEl.current?.getBoundingClientRect() ?? null);
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !triggerEl.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerEl.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const els = Array.from(
      menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []
    );
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const style: React.CSSProperties | undefined = rect
    ? {
        position: 'fixed',
        minWidth,
        ...(side === 'bottom' ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }),
        ...(align === 'end' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
      }
    : undefined;

  const itemClass = (danger?: boolean, disabled?: boolean) =>
    cn(
      'flex w-full items-center gap-2 h-8 px-2 rounded-ds-sm text-[13px] text-left transition-colors',
      'focus:outline-none focus:bg-surface-2 hover:bg-surface-2 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
      danger ? 'text-danger-dark dark:text-danger-light' : 'text-ink',
      disabled && 'opacity-50 pointer-events-none'
    );

  return (
    <>
      {trigger({
        ref: (node) => {
          triggerEl.current = node;
        },
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': id,
      })}
      {open && rect && (
        <Portal>
          <div
            ref={menu}
            id={id}
            role="menu"
            style={style}
            onKeyDown={onKeyDown}
            className={cn(
              'z-[60] p-1 rounded-ds-md border border-line bg-surface shadow-pop animate-fade-in',
              className
            )}
          >
            {header && <div className="px-2 py-2 mb-1 border-b border-line">{header}</div>}
            {items.map((item, i) => {
              if (item.type === 'separator') return <div key={i} role="separator" className="my-1 h-px bg-line" />;
              if (item.type === 'label')
                return (
                  <div key={i} className="px-2 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-subtle">
                    {item.label}
                  </div>
                );
              const inner = (
                <>
                  {item.icon && <span className="text-muted inline-flex">{item.icon}</span>}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="text-xs text-subtle">{item.hint}</span>}
                </>
              );
              return (
                <Fragment key={i}>
                  {item.href && !item.disabled ? (
                    <Link
                      href={item.href}
                      role="menuitem"
                      tabIndex={-1}
                      className={itemClass(item.danger)}
                      onClick={() => close(false)}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      aria-disabled={item.disabled || undefined}
                      className={itemClass(item.danger, item.disabled)}
                      onClick={() => {
                        if (item.disabled) return;
                        close();
                        item.onSelect?.();
                      }}
                    >
                      {inner}
                    </button>
                  )}
                </Fragment>
              );
            })}
          </div>
        </Portal>
      )}
    </>
  );
}
