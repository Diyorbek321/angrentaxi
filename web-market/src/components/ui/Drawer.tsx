// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { Portal } from './Portal';
import { useDialog } from './use-dialog';
import { kitT } from '@/lib/i18n/kit-messages';

export type DrawerWidth = 'sm' | 'md' | 'lg' | 'xl';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sticky action row; omit for read-only drawers. Accepts `false`. */
  footer?: ReactNode;
  width?: DrawerWidth;
  className?: string;
  bodyClassName?: string;
}

const widthClasses: Record<DrawerWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-3xl',
};

/**
 * Right-hand side panel for inspecting a record without leaving the list.
 * Portal + scrim + Esc + focus trap; header and footer stick, body scrolls.
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
  bodyClassName,
}: DrawerProps) {
  const ref = useDialog<HTMLElement>(isOpen, onClose);
  const titleId = useId();

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex justify-end bg-scrim/55 animate-fade-in"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="presentation"
      >
        <aside
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          className={cn(
            'h-full w-full flex flex-col bg-surface border-l border-line shadow-pop',
            'sm:rounded-l-ds-xl animate-slide-in-right focus:outline-none',
            widthClasses[width],
            className
          )}
        >
          <div className="flex items-start justify-between gap-3 px-5 h-14 py-3 border-b border-line shrink-0">
            <div className="min-w-0 self-center">
              {title && (
                <h2 id={titleId} className="text-title text-ink truncate">
                  {title}
                </h2>
              )}
              {subtitle && <div className="text-xs text-muted truncate">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={kitT().common.close}
              className={cn(
                'shrink-0 self-center h-8 w-8 inline-flex items-center justify-center rounded-ds-sm text-muted',
                'hover:text-ink hover:bg-surface-2 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
              )}
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          <div className={cn('flex-1 overflow-y-auto p-5 space-y-5', bodyClassName)}>{children}</div>

          {footer ? (
            <div className="shrink-0 border-t border-line px-5 py-3 bg-surface-2/40">{footer}</div>
          ) : null}
        </aside>
      </div>
    </Portal>
  );
}
