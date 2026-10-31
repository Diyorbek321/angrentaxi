// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from './cn';
import { kitT } from '@/lib/i18n/kit-messages';

/**
 * Non-blocking feedback for routine actions. Bottom-right, 4s, optional
 * action (e.g. "Qaytarish" undo). Dependency-free, same contract in every
 * panel: `useToast().toast({ title, description?, variant?, action? })`.
 */

export type ToastVariant = 'default' | 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
  /** Screen-reader description of the action (Radix-compatible). */
  altText?: string;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  /** ms; default 4000 (6000 when there is an action to reach). */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
}

export interface ToastContextValue {
  toast: (item: ToastOptions) => void;
  dismiss: (id?: string) => void;
}

const DEFAULT_DURATION_MS = 4000;
const ACTION_DURATION_MS = 6000;

const variantIcons: Record<ToastVariant, ReactNode> = {
  default: null,
  success: <CheckCircle2 size={16} className="text-mint-deep dark:text-mint-soft shrink-0 mt-px" aria-hidden />,
  error: <AlertCircle size={16} className="text-danger shrink-0 mt-px" aria-hidden />,
  info: <Info size={16} className="text-info shrink-0 mt-px" aria-hidden />,
};

/** Screen-reader prefix; read at render time so it follows the active locale. */
function variantSr(variant: ToastVariant): string {
  return variant === 'default' ? '' : kitT().toast[variant];
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {}, dismiss: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const variant = item.variant ?? 'default';
  const duration = item.duration ?? (item.action ? ACTION_DURATION_MS : DEFAULT_DURATION_MS);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(item.id), duration);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss, paused, duration]);

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        'pointer-events-auto relative flex w-full items-start gap-2.5',
        'rounded-ds-md border border-line bg-surface p-3 pr-9 shadow-pop animate-slide-up',
        variant === 'error' && 'border-danger/40'
      )}
    >
      {variantIcons[variant]}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">
          <span className="sr-only">{variantSr(variant)}</span>
          {item.title}
        </p>
        {item.description && <p className="text-[13px] text-muted mt-0.5 break-words">{item.description}</p>}
        {item.action && (
          <button
            type="button"
            aria-label={item.action.altText ?? item.action.label}
            onClick={() => {
              void item.action?.onClick();
              onDismiss(item.id);
            }}
            className="mt-2 text-[13px] font-semibold text-primary-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-ds-xs"
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label={kitT().common.close}
        onClick={() => onDismiss(item.id)}
        className="absolute right-2 top-2 h-6 w-6 inline-flex items-center justify-center rounded-ds-xs text-subtle transition-colors hover:text-ink hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

export function ToastContextProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((item: ToastOptions) => {
    counter.current += 1;
    const id = `t${counter.current}`;
    // Max 4 on screen — the oldest leaves first.
    setToasts((prev) => [...prev.slice(-3), { ...item, id }]);
  }, []);

  const dismiss = useCallback((id?: string) => {
    setToasts((prev) => (id ? prev.filter((t) => t.id !== id) : []));
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-label={kitT().toast.region}
        className="pointer-events-none fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[380px]"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Alias for panels that call it `ToastProvider`. */
export const ToastProvider = ToastContextProvider;
