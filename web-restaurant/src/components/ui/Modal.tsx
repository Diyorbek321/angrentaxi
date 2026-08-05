'use client';

import { ReactNode, useId } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { useDialog } from '@/lib/use-dialog';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Sarlavha ostidagi kichik qator — kontekst, ko'rsatma emas. */
  subtitle?: string;
  children: ReactNode;
  /** Pastdagi harakatlar qatori. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
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
  override: 'border-override/40 bg-override-tint',
  danger: 'border-danger/40 bg-danger-tint',
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
  const dialogRef = useDialog<HTMLDivElement>(isOpen, onClose);
  const titleId = useId();
  const subtitleId = useId();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#04140F]/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={clsx(
          'relative w-full bg-surface border border-line rounded-ds-lg shadow-pop',
          'flex flex-col max-h-[90vh] animate-slide-up',
          sizeClasses[size],
          className
        )}
      >
        <div
          className={clsx(
            'flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0 rounded-t-ds-lg',
            toneClasses[tone]
          )}
        >
          <div className="min-w-0">
            <h2 id={titleId} className="text-h3 text-ink">
              {title}
            </h2>
            {subtitle && (
              <p id={subtitleId} className="text-caption text-muted mt-0.5">
                {subtitle}
              </p>
            )}
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

        <div className="overflow-y-auto flex-1 p-5">{children}</div>

        {footer && <div className="border-t border-line px-5 py-4 shrink-0 bg-surface-2/50">{footer}</div>}
      </div>
    </div>
  );
}
