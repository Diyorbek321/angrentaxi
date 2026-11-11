// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { Portal } from './Portal';
import { useDialog } from './use-dialog';
import { kitT } from '@/lib/i18n/kit-messages';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
export type ModalTone = 'default' | 'override' | 'danger';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** One line under the title — context, not instructions. */
  subtitle?: ReactNode;
  /** Alias of `subtitle`. */
  description?: ReactNode;
  children: ReactNode;
  /** Sticky action row (right-aligned buttons). */
  footer?: ReactNode;
  size?: ModalSize;
  /** `override` = deliberate manual intervention (amber edge); `danger` = destructive. */
  tone?: ModalTone;
  /** Hide the × button (the footer must then offer a way out). */
  hideClose?: boolean;
  className?: string;
  /** Extra classes for the scrollable body. */
  bodyClassName?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

const toneBar: Record<ModalTone, string | null> = {
  default: null,
  override: 'bg-override',
  danger: 'bg-danger',
};

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={kitT().common.close}
      className={cn(
        'shrink-0 -mr-1 h-7 w-7 inline-flex items-center justify-center rounded-ds-sm text-muted',
        'hover:text-ink hover:bg-surface-2 transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
      )}
    >
      <X size={16} aria-hidden />
    </button>
  );
}

/** Shared scrim + centred panel. Rendered through a portal. */
function ModalFrame({
  isOpen,
  onClose,
  size = 'md',
  className,
  labelledBy,
  describedBy,
  ariaLabel,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  size?: ModalSize;
  className?: string;
  labelledBy?: string;
  describedBy?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const ref = useDialog<HTMLDivElement>(isOpen, onClose);
  if (!isOpen) return null;
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/55 animate-fade-in"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="presentation"
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-label={labelledBy ? undefined : ariaLabel}
          tabIndex={-1}
          className={cn(
            'relative w-full max-h-[90vh] flex flex-col overflow-hidden',
            'bg-surface border border-line rounded-ds-lg shadow-pop animate-scale-in',
            'focus:outline-none',
            sizeClasses[size],
            className
          )}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}

/**
 * Centred dialog. Portal, scrim (`--scrim`), Esc, focus trap, focus return.
 * Title 15px/600; body scrolls; footer sticks.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  description,
  children,
  footer,
  size = 'md',
  tone = 'default',
  hideClose = false,
  className,
  bodyClassName,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const sub = subtitle ?? description;
  const bar = toneBar[tone];

  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      size={size}
      className={className}
      labelledBy={title ? titleId : undefined}
      describedBy={sub ? descId : undefined}
    >
      {bar && <span aria-hidden className={cn('absolute inset-x-0 top-0 h-0.5', bar)} />}
      {(title || !hideClose) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 shrink-0">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-title text-ink">
                {title}
              </h2>
            )}
            {sub && (
              <div id={descId} className="text-[13px] text-muted mt-0.5">
                {sub}
              </div>
            )}
          </div>
          {!hideClose && <CloseButton onClick={onClose} />}
        </div>
      )}
      <div className={cn('overflow-y-auto flex-1 px-5 pb-5', !title && hideClose && 'pt-5', bodyClassName)}>
        {children}
      </div>
      {footer && (
        <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-line bg-surface-2/40">
          {footer}
        </div>
      )}
    </ModalFrame>
  );
}

/* ---------------------------------------------------------------------------
 * Radix-compatible composition API (web-admin call sites):
 *   <Dialog open onOpenChange><DialogContent className>
 *     <DialogHeader><DialogTitle/><DialogDescription/></DialogHeader>
 *     …<DialogFooter className="gap-2">…</DialogFooter>
 *   </DialogContent></Dialog>
 * Implemented on the same frame — no Radix dependency.
 * ------------------------------------------------------------------------- */

interface DialogCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descId: string;
}

const DialogContext = createContext<DialogCtx | null>(null);

function useDialogCtx(name: string): DialogCtx {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error(`<${name}> must be used inside <Dialog>`);
  return ctx;
}

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  const titleId = useId();
  const descId = useId();
  return (
    <DialogContext.Provider
      value={{ open, setOpen: (next) => onOpenChange?.(next), titleId, descId }}
    >
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  size?: ModalSize;
  hideClose?: boolean;
}

export function DialogContent({
  className,
  children,
  size = 'lg',
  hideClose = false,
}: DialogContentProps) {
  const { open, setOpen, titleId, descId } = useDialogCtx('DialogContent');
  const close = () => setOpen(false);
  return (
    <ModalFrame
      isOpen={open}
      onClose={close}
      size={size}
      labelledBy={titleId}
      describedBy={descId}
      className={cn('p-5 gap-4 overflow-y-auto', className)}
    >
      {!hideClose && (
        <div className="absolute right-4 top-4">
          <CloseButton onClick={close} />
        </div>
      )}
      {children}
    </ModalFrame>
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 pr-8', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1', className)}
      {...props}
    />
  );
}

export const DialogTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    const { titleId } = useDialogCtx('DialogTitle');
    return <h2 ref={ref} id={titleId} className={cn('text-title text-ink', className)} {...props} />;
  }
);
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { descId } = useDialogCtx('DialogDescription');
  return <p ref={ref} id={descId} className={cn('text-[13px] text-muted', className)} {...props} />;
});
DialogDescription.displayName = 'DialogDescription';

/** Closes the surrounding Dialog; renders its child button as-is otherwise. */
export function DialogClose({ children }: { children: ReactNode }) {
  const { setOpen } = useDialogCtx('DialogClose');
  return (
    <span className="contents" onClickCapture={() => setOpen(false)}>
      {children}
    </span>
  );
}
