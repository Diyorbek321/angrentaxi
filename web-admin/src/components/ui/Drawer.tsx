'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Yopishqoq harakat qatori; faqat o'qish uchun panelga kerak emas. */
  footer?: ReactNode;
  width?: 'md' | 'lg';
  className?: string;
}

const widthClasses = {
  md: 'max-w-md',
  lg: 'max-w-xl',
};

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * O'ng tomondan chiqadigan panel. Modal kabi u ham fokusni ushlab turadi:
 * ochilganda birinchi elementga o'tadi, Tab halqasi panel ichida qoladi,
 * yopilganda fokus chaqirgan tugmaga qaytadi.
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
  className,
}: DrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      restoreFocusTo.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end bg-[#04140F]/50 backdrop-blur-[2px] animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="presentation"
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'flex h-full w-full flex-col border-l border-line bg-surface shadow-pop animate-slide-in-right',
          widthClasses[width],
          className
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="truncate text-h3 text-ink">{title}</h2>}
            {subtitle && <div className="mt-0.5 text-caption text-muted">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className={cn(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-sm text-muted',
              'transition-colors duration-fast hover:bg-surface-2 hover:text-ink',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-line bg-surface-2/50 px-5 py-3">{footer}</div>
        )}
      </aside>
    </div>
  );
}
