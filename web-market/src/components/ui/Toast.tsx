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
      'fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

type ToastVariant = 'default' | 'success' | 'error' | 'info';

/**
 * Tinted surfaces, never saturated fills: the toast body has to stay readable
 * in both themes, so the semantic hue lives in the border and the icon rather
 * than in the background. `success` uses the mint *tint* with ink text — mint
 * itself carries no meaning on a light surface (2.12:1).
 */
const toastStyles: Record<ToastVariant, string> = {
  default: 'bg-surface border-line',
  success: 'bg-mint-tint border-mint/40',
  error: 'bg-danger-tint border-danger/40',
  info: 'bg-info-tint border-info/40',
};

const ToastRoot = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & { variant?: ToastVariant }
>(({ className, variant = 'default', ...props }, ref) => {
  return (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(
        'group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden',
        'rounded-ds-md border p-4 pr-8 shadow-pop transition-all text-ink',
        'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
        'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none',
        'data-[state=open]:animate-slide-up',
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
      'absolute right-2 top-2 rounded-ds-xs p-1 text-muted transition-colors hover:text-ink hover:bg-surface-2',
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
  <ToastPrimitive.Title
    ref={ref}
    className={cn('text-sm font-semibold text-ink', className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted', className)}
    {...props}
  />
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

  // The icon repeats what the tint says, so colour is never the only signal.
  const icons: Record<ToastVariant, React.ReactNode> = {
    default: null,
    success: <CheckCircle className="h-5 w-5 text-primary-text shrink-0" aria-hidden />,
    error: (
      <AlertCircle className="h-5 w-5 text-danger-deep dark:text-danger-light shrink-0" aria-hidden />
    ),
    info: <Info className="h-5 w-5 text-info-deep dark:text-info-light shrink-0" aria-hidden />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastProvider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastRoot
            key={t.id}
            variant={t.variant}
            onOpenChange={(open) => !open && remove(t.id)}
            defaultOpen
          >
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
