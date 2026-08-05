'use client';

import { ReactNode, useId } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { useDialog } from '@/lib/use-dialog';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Yopishqoq harakatlar qatori; faqat o'qish uchun panelda bo'lmaydi. */
  footer?: ReactNode;
  width?: 'md' | 'lg';
  className?: string;
}

const widthClasses = {
  md: 'max-w-md',
  lg: 'max-w-xl',
};

/** O'ng tomondan chiqadigan panel — buyurtma tafsilotlari uchun. */
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
  const dialogRef = useDialog<HTMLElement>(isOpen, onClose);
  const titleId = useId();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#04140F]/50 backdrop-blur-[2px] animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'h-full w-full bg-surface border-l border-line shadow-pop flex flex-col animate-slide-in-right',
          widthClasses[width],
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-h3 text-ink truncate">
              {title}
            </h2>
            {subtitle && <div className="text-caption text-muted mt-1">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-ds-xs text-muted hover:text-ink hover:bg-surface-2 transition-colors duration-fast"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>

        {footer && <div className="border-t border-line px-5 py-4 shrink-0 bg-surface-2/50">{footer}</div>}
      </aside>
    </div>
  );
}
