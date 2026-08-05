'use client';

import * as React from 'react';
import { X, CheckCircle2, AlertCircle, Info, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'default' | 'success' | 'error' | 'info';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. 0 keeps it until the vendor closes it. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (item: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return React.useContext(ToastContext);
}

const variantStyles: Record<ToastVariant, { accent: string; icon: React.ReactNode }> = {
  default: { accent: 'bg-line-strong', icon: <Bell size={17} className="text-muted" /> },
  success: {
    accent: 'bg-primary',
    icon: <CheckCircle2 size={17} className="text-primary-600 dark:text-primary-300" />,
  },
  error: { accent: 'bg-danger', icon: <AlertCircle size={17} className="text-danger" /> },
  info: { accent: 'bg-info', icon: <Info size={17} className="text-info dark:text-blue-300" /> },
};

const DEFAULT_DURATION = 4500;

export function ToastContextProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);

  const remove = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback((item: ToastOptions) => {
    counter.current += 1;
    const id = `t${counter.current}`;
    // Cap the stack — a burst of new orders must not bury the whole screen.
    setToasts((prev) => [...prev.slice(-3), { ...item, id }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm pointer-events-none"
        role="region"
        aria-label="Bildirishnomalar"
      >
        {toasts.map((t) => (
          <ToastRow key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const { accent, icon } = variantStyles[item.variant ?? 'default'];
  const duration = item.duration ?? DEFAULT_DURATION;

  React.useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto relative flex items-start gap-3 overflow-hidden',
        'rounded-xl border border-line bg-surface shadow-pop pl-4 pr-9 py-3',
        'animate-slide-in-right'
      )}
    >
      <span className={cn('absolute left-0 top-0 bottom-0 w-1', accent)} aria-hidden />
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{item.title}</p>
        {item.description && (
          <p className="text-xs text-muted mt-0.5 break-words">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Yopish"
        className="absolute right-2 top-2 h-6 w-6 inline-flex items-center justify-center rounded-md text-subtle hover:text-ink hover:bg-surface-2 transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  );
}
