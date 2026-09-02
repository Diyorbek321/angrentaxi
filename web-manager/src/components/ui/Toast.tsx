'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Non-blocking feedback for routine actions (skill rule: optimistic updates +
 * toasts for routine acts; confirmation modals only for destructive ones).
 *
 * Ported from web-market's Toast pattern. web-market builds on
 * @radix-ui/react-toast; that package is not a dependency of this panel and
 * package.json is frozen, so this is a dependency-free implementation of the
 * same contract: `useToast().toast({ title, description?, variant? })`.
 */

type ToastVariant = 'default' | 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, 'id'>) => void;
}

const TOAST_DURATION_MS = 5000;

/**
 * Tinted surfaces, never saturated fills: the semantic hue lives in the
 * border and the icon, the body stays readable in both themes. `success`
 * uses the mint *tint* with ink text — mint itself carries no meaning on a
 * light surface (2.12:1, see DESIGN-TOKENS.md §2.1).
 */
const variantClasses: Record<ToastVariant, string> = {
  default: 'bg-surface border-line',
  success: 'bg-mint-tint border-mint/40',
  error: 'bg-danger-tint border-danger/40',
  info: 'bg-info-tint border-info/40',
};

/** The icon repeats what the tint says, so colour is never the only signal. */
const variantIcons: Record<ToastVariant, ReactNode> = {
  default: null,
  success: <CheckCircle size={18} className="text-primary-text shrink-0 mt-0.5" aria-hidden />,
  error: (
    <AlertCircle size={18} className="text-danger-deep dark:text-danger-light shrink-0 mt-0.5" aria-hidden />
  ),
  info: <Info size={18} className="text-info-deep dark:text-info-light shrink-0 mt-0.5" aria-hidden />,
};

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  // Each toast owns its dismiss timer; unmount (manual close) cancels it.
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div
      // role=status + the polite viewport below announce without interrupting.
      role="status"
      className={clsx(
        'pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden',
        'rounded-ds-md border p-4 pr-9 shadow-pop text-ink animate-slide-up',
        variantClasses[item.variant ?? 'default']
      )}
    >
      {variantIcons[item.variant ?? 'default']}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{item.title}</p>
        {item.description && <p className="text-sm text-muted mt-0.5">{item.description}</p>}
      </div>
      <button
        type="button"
        aria-label="Yopish"
        onClick={() => onDismiss(item.id)}
        className="absolute right-2 top-2 rounded-ds-xs p-1 text-muted transition-colors hover:text-ink hover:bg-surface-2"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function ToastContextProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((item: Omit<ToastItem, 'id'>) => {
    counter.current += 1;
    const id = `t${counter.current}`;
    setToasts((prev) => [...prev, { ...item, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Bildirishnomalar"
        className="pointer-events-none fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[400px]"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
