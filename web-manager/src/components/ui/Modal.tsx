'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Small line under the title — context, not instructions. */
  subtitle?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** `override` paints the header amber, marking a deliberate manual action. */
  tone?: 'default' | 'override' | 'danger';
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
  override: 'border-override/40 bg-override/[0.06]',
  danger: 'border-danger/40 bg-danger/[0.06]',
};

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#04140F]/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'relative w-full bg-surface border border-line rounded-2xl shadow-pop',
          'flex flex-col max-h-[90vh] animate-slide-up',
          sizeClasses[size],
          className
        )}
      >
        {title && (
          <div
            className={clsx(
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
      </div>
    </div>
  );
}
