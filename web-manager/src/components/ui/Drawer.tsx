'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sticky action row; omit entirely for read-only drawers. */
  footer?: ReactNode;
  width?: 'md' | 'lg';
  className?: string;
}

const widthClasses = {
  md: 'max-w-md',
  lg: 'max-w-xl',
};

/**
 * Right-hand side panel. The dispatch order drawer is intentionally
 * read-only — inspecting an order must never become a way to assign a driver.
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

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
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
        role="dialog"
        aria-modal="true"
        className={clsx(
          'h-full w-full bg-surface border-l border-line shadow-pop flex flex-col animate-slide-in-right',
          widthClasses[width],
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>}
            {subtitle && <div className="text-xs text-muted mt-0.5">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>

        {footer && (
          <div className="border-t border-line px-5 py-3 shrink-0 bg-surface-2/50">{footer}</div>
        )}
      </aside>
    </div>
  );
}
