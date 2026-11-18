// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from './cn';
import { Portal } from './Portal';

export interface TooltipProps {
  content: ReactNode;
  /** The trigger — must be a single focusable element. */
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Render nothing extra (e.g. sidebar expanded: label already visible). */
  disabled?: boolean;
  delay?: number;
  className?: string;
}

const GAP = 8;

/**
 * Hover/focus tooltip rendered through a portal (never clipped by an
 * overflow container — the sidebar rail). Wrapper is `display: contents`.
 */
export function Tooltip({ content, children, side = 'top', disabled = false, delay = 300, className }: TooltipProps) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  if (disabled || content == null || content === '') return children;

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = anchor.current?.firstElementChild as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      if (!r) return;
      const map = {
        top: { top: r.top - GAP, left: r.left + r.width / 2 },
        bottom: { top: r.bottom + GAP, left: r.left + r.width / 2 },
        left: { top: r.top + r.height / 2, left: r.left - GAP },
        right: { top: r.top + r.height / 2, left: r.right + GAP },
      };
      setPos(map[side]);
    }, delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setPos(null);
  };

  const transform = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0, -50%)',
  }[side];

  return (
    <span
      ref={anchor}
      className="contents"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => e.key === 'Escape' && hide()}
      aria-describedby={pos ? id : undefined}
    >
      {children}
      {pos && (
        <Portal>
          <span
            id={id}
            role="tooltip"
            style={{ position: 'fixed', top: pos.top, left: pos.left, transform }}
            className={cn(
              'z-[70] pointer-events-none max-w-xs rounded-ds-sm px-2 py-1',
              'bg-ink text-bg text-xs font-medium shadow-pop animate-fade-in',
              className
            )}
          >
            {content}
          </span>
        </Portal>
      )}
    </span>
  );
}
