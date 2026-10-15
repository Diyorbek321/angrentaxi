// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { Field, controlBase, controlBorder, describedBy } from './Field';
import { Portal } from './Portal';

/*
 * Two APIs, one name:
 *   1. Native (manager/market/restaurant):  <Select options={[…]} value onChange label />
 *      → a real <select>, forwardRef, react-hook-form `register` compatible.
 *   2. Composed (web-admin, Radix-shaped):
 *      <Select value onValueChange><SelectTrigger><SelectValue placeholder/></SelectTrigger>
 *        <SelectContent><SelectItem value>…</SelectItem></SelectContent></Select>
 *      → dependency-free listbox popover (portal, keyboard, type-ahead-free).
 * `options` present ⇒ native.
 */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface NativeSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: readonly SelectOption[];
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  wrapperClassName?: string;
  onValueChange?: never;
}

export interface ComposedSelectProps {
  options?: undefined;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  children: ReactNode;
}

export type SelectProps = NativeSelectProps | ComposedSelectProps;

const heights = { sm: 'h-7 text-[13px]', md: 'h-8', lg: 'h-10' } as const;

const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    { label, error, hint, options, placeholder, size = 'md', wrapperClassName, className, id, required, ...props },
    ref
  ) => {
    const auto = useId();
    const selectId = id ?? auto;
    return (
      <Field id={selectId} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(selectId, error, hint)}
            className={cn(controlBase, controlBorder(!!error), heights[size], 'appearance-none pl-2.5 pr-8', className)}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            aria-hidden
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none"
          />
        </div>
      </Field>
    );
  }
);
NativeSelect.displayName = 'NativeSelect';

/* ----------------------------------------------------------- composed --- */

interface Ctx {
  value: string | undefined;
  select: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  labels: Map<string, ReactNode>;
  register: (value: string, label: ReactNode) => void;
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  listId: string;
  version: number;
}

const SelectContext = createContext<Ctx | null>(null);

function useSelectCtx(name: string): Ctx {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error(`<${name}> must be used inside <Select>`);
  return ctx;
}

function ComposedSelect({ value, defaultValue, onValueChange, disabled = false, name, children }: ComposedSelectProps) {
  const [inner, setInner] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const labels = useRef(new Map<string, ReactNode>()).current;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listId = useId();
  const current = value !== undefined ? value : inner;

  const register = useCallback(
    (v: string, label: ReactNode) => {
      // Strings update live; JSX labels register once (a new element every
      // render would otherwise loop).
      const known = labels.has(v);
      if (!known || (typeof label === 'string' && labels.get(v) !== label)) {
        labels.set(v, label);
        setVersion((n) => n + 1);
      }
    },
    [labels]
  );

  const select = (v: string) => {
    if (value === undefined) setInner(v);
    onValueChange?.(v);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <SelectContext.Provider
      value={{ value: current, select, open, setOpen, disabled, labels, register, triggerRef, listId, version }}
    >
      {children}
      {name && <input type="hidden" name={name} value={current ?? ''} />}
    </SelectContext.Provider>
  );
}

/** One component, two APIs (see top of file). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>((props, ref) => {
  if (props.options) return <NativeSelect ref={ref} {...(props as NativeSelectProps)} />;
  return <ComposedSelect {...(props as ComposedSelectProps)} />;
});
Select.displayName = 'Select';

export interface SelectTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md';
}

export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, disabled, size = 'md', ...props }, ref) => {
    const ctx = useSelectCtx('SelectTrigger');
    const isDisabled = disabled || ctx.disabled;
    return (
      <button
        type="button"
        ref={(node) => {
          ctx.triggerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={ctx.open}
        aria-controls={ctx.listId}
        disabled={isDisabled}
        onClick={() => ctx.setOpen(!ctx.open)}
        onKeyDown={(e) => {
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
            e.preventDefault();
            ctx.setOpen(true);
          }
        }}
        className={cn(
          controlBase,
          controlBorder(false),
          size === 'sm' ? 'h-7 text-[13px]' : 'h-8',
          'inline-flex items-center justify-between gap-2 pl-2.5 pr-2 text-left',
          className
        )}
        {...props}
      >
        <span className="truncate">{children}</span>
        <ChevronDown size={15} aria-hidden className="text-subtle shrink-0" />
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

export function SelectValue({ placeholder }: { placeholder?: ReactNode }) {
  const ctx = useSelectCtx('SelectValue');
  const label = ctx.value !== undefined && ctx.value !== '' ? ctx.labels.get(ctx.value) ?? ctx.value : undefined;
  if (label === undefined) return <span className="text-subtle">{placeholder}</span>;
  return <>{label}</>;
}

export function SelectContent({ children, className }: { children: ReactNode; className?: string; position?: string }) {
  const ctx = useSelectCtx('SelectContent');
  const listRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!ctx.open) return;
    const place = () => {
      const r = ctx.triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const up = window.innerHeight - r.bottom < 260 && r.top > 260;
      setRect({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, width: r.width, up });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [ctx.open, ctx.triggerRef]);

  useEffect(() => {
    if (!ctx.open) return;
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    (selected ?? list?.querySelector<HTMLElement>('[role="option"]:not([aria-disabled="true"])'))?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!list?.contains(t) && !ctx.triggerRef.current?.contains(t)) ctx.setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ctx.open, ctx]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? []
    );
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[Math.min(items.length - 1, i + 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[Math.max(0, i - 1)]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      ctx.setOpen(false);
      ctx.triggerRef.current?.focus();
    }
  };

  // Items stay mounted (hidden) while closed so SelectValue can show labels.
  if (!ctx.open || !rect) {
    return (
      <div hidden aria-hidden>
        {children}
      </div>
    );
  }

  return (
    <Portal>
      <div
        ref={listRef}
        id={ctx.listId}
        role="listbox"
        onKeyDown={onKeyDown}
        style={{
          position: 'fixed',
          left: rect.left,
          minWidth: rect.width,
          ...(rect.up ? { bottom: window.innerHeight - rect.top } : { top: rect.top }),
        }}
        className={cn(
          'z-[60] max-h-64 overflow-y-auto p-1 rounded-ds-md border border-line bg-surface shadow-pop animate-fade-in',
          className
        )}
      >
        {children}
      </div>
    </Portal>
  );
}

export interface SelectItemProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function SelectItem({ value, children, disabled = false, className }: SelectItemProps) {
  const ctx = useSelectCtx('SelectItem');
  const { register } = ctx;
  useEffect(() => {
    register(value, children);
  }, [register, value, children]);
  const selected = ctx.value === value;
  return (
    <div
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      onClick={() => !disabled && ctx.select(value)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          ctx.select(value);
        }
      }}
      className={cn(
        'relative flex items-center gap-2 h-8 pl-7 pr-2.5 rounded-ds-sm text-[13px] text-ink cursor-pointer select-none',
        'hover:bg-surface-2 focus:bg-surface-2 focus:outline-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {selected && <Check size={14} aria-hidden className="absolute left-2 text-primary-text" />}
      <span className="truncate">{children}</span>
    </div>
  );
}

export function SelectGroup({ children }: { children: ReactNode }) {
  return <div role="group">{children}</div>;
}

export function SelectLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-subtle', className)}>
      {children}
    </div>
  );
}

export function SelectSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn('my-1 h-px bg-line', className)} />;
}
