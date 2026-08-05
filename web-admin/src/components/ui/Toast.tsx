'use client';

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const ToastProvider = ToastPrimitive.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed right-0 top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

type ToastVariant = 'default' | 'success' | 'error' | 'info';

// Har bir ohang tinted yuza + `*-deep` matn. Ma'no rang bilan birga IKONKA va
// MATN orqali ham beriladi (WCAG 1.4.1).
const toastStyles: Record<ToastVariant, string> = {
  default: 'bg-surface border-line text-ink',
  success: 'bg-mint-tint border-mint/40 text-ink',
  error: 'bg-danger-tint border-danger/40 text-ink',
  info: 'bg-info-tint border-info/40 text-ink',
};

const ToastRoot = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & { variant?: ToastVariant }
>(({ className, variant = 'default', ...props }, ref) => {
  return (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(
        'group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-ds-md border p-4 pr-9 shadow-pop',
        'transition-all duration-base ease-emphasized animate-slide-up',
        'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
        'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none',
        toastStyles[variant],
        className
      )}
      {...props}
    />
  );
});
ToastRoot.displayName = ToastPrimitive.Root.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    aria-label="Yopish"
    className={cn(
      'absolute right-2 top-2 rounded-ds-xs p-1 text-muted transition-colors duration-fast',
      'hover:bg-surface-2 hover:text-ink',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitive.Close>
));
ToastClose.displayName = ToastPrimitive.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn('text-body font-semibold', className)} {...props} />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn('text-body text-muted', className)} {...props} />
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

/** Ohangni so'z bilan ham aytadi — ekran o'quvchi rangni ko'rmaydi. */
const variantLabel: Record<ToastVariant, string | null> = {
  default: null,
  success: 'Muvaffaqiyat',
  error: 'Xato',
  info: 'Maʼlumot',
};

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
    success: <CheckCircle className="h-5 w-5 shrink-0 text-primary-text" />,
    error: <AlertCircle className="h-5 w-5 shrink-0 text-danger-deep dark:text-danger-light" />,
    info: <Info className="h-5 w-5 shrink-0 text-info-deep dark:text-info-light" />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastProvider swipeDirection="right">
        {children}
        {toasts.map((t) => {
          const variant = t.variant ?? 'default';
          const label = variantLabel[variant];
          return (
            <ToastRoot
              key={t.id}
              variant={variant}
              onOpenChange={(open) => !open && remove(t.id)}
              defaultOpen
            >
              <div className="flex items-start gap-3">
                <span aria-hidden="true">{icons[variant]}</span>
                <div className="grid gap-1">
                  <ToastTitle>
                    {label && <span className="sr-only">{label}: </span>}
                    {t.title}
                  </ToastTitle>
                  {t.description && <ToastDescription>{t.description}</ToastDescription>}
                </div>
              </div>
              <ToastClose />
            </ToastRoot>
          );
        })}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}
