'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Small line under the title — context, not instructions. */
  subtitle?: string;
  children: ReactNode;
  /** Sticky action row pinned to the bottom of the dialog. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'default' | 'danger';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

const toneClasses: Record<NonNullable<ModalProps['tone']>, string> = {
  default: 'border-line',
  danger: 'border-danger/40 bg-danger/[0.06]',
};

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  tone = 'default',
  className,
}: ModalProps) {
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

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full bg-surface border border-line rounded-2xl shadow-pop',
          'flex flex-col max-h-[90vh] animate-slide-up',
          sizeClasses[size],
          className
        )}
      >
        {title && (
          <div
            className={cn(
              'flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0 rounded-t-2xl',
              toneClasses[tone]
            )}
          >
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">{title}</h2>
              {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
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
        )}

        <div className="overflow-y-auto flex-1 p-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-line px-5 py-3.5 flex items-center justify-end gap-2 rounded-b-2xl bg-surface-2/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
