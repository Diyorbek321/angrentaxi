'use client';

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';

const ToastProvider = ToastPrimitive.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={clsx(
      'fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

type ToastVariant = 'default' | 'success' | 'error' | 'info';

/**
 * Toast ham ikkala temada ishlaydi: fon — `surface`, chekka esa semantik
 * tint. Ma'no faqat rang bilan emas, ikonka bilan ham beriladi.
 */
const toastStyles: Record<ToastVariant, string> = {
  default: 'bg-surface border-line',
  success: 'bg-surface border-mint/45',
  error: 'bg-surface border-danger/45',
  info: 'bg-surface border-info/45',
};

const ToastRoot = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & { variant?: ToastVariant }
>(({ className, variant = 'default', ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={clsx(
      'group pointer-events-auto relative flex w-full items-start justify-between gap-4',
      'overflow-hidden rounded-ds-md border p-4 pr-10 shadow-pop text-ink',
      'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
      'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none',
      'data-[state=open]:animate-slide-up',
      toastStyles[variant],
      className
    )}
    {...props}
  />
));
ToastRoot.displayName = ToastPrimitive.Root.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    aria-label="Yopish"
    className={clsx(
      'absolute right-2 top-2 rounded-ds-xs p-1.5 text-subtle transition-colors hover:text-ink hover:bg-surface-2',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" aria-hidden />
  </ToastPrimitive.Close>
));
ToastClose.displayName = ToastPrimitive.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={clsx('text-title text-ink', className)} {...props} />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={clsx('text-body text-muted', className)} {...props} />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;

// ─── Toast context ──────────────────────────────────────────────────

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = React.createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastContextProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...item, id }]);
  }, []);

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const icons: Record<ToastVariant, React.ReactNode> = {
    default: null,
    success: <CheckCircle2 className="h-5 w-5 text-primary-text shrink-0" aria-hidden />,
    error: <AlertCircle className="h-5 w-5 text-danger-deep dark:text-danger-light shrink-0" aria-hidden />,
    info: <Info className="h-5 w-5 text-info-deep dark:text-info-light shrink-0" aria-hidden />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastProvider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastRoot key={t.id} variant={t.variant} onOpenChange={(open) => !open && remove(t.id)} defaultOpen>
            <div className="flex items-start gap-3">
              {icons[t.variant ?? 'default']}
              <div className="grid gap-1">
                <ToastTitle>{t.title}</ToastTitle>
                {t.description && <ToastDescription>{t.description}</ToastDescription>}
              </div>
            </div>
            <ToastClose />
          </ToastRoot>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}
