import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

/**
 * ⚠️ Ikki qatlamli brend modeli (docs/DESIGN-TOKENS.md 3.1 / 7.1):
 * tugma — INTERAKTIV element, shuning uchun foni `primary` (#0C7A4D) va
 * yozuvi OQ (5.38:1). `mint` hech qachon tugma foni bo'lmaydi (oq bilan
 * 2.12:1) — u faqat chip/badge/dekorativ yuza uchun.
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'outline'
  /** Ogohlantiruvchi, lekin buzmaydigan harakat. */
  | 'override';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'kitchen';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    // Qorong'i temada to'ldirish `primary-on-dark` (#0E8855) — u `surface-2`
    // bilan 3.56:1 beradi, oddiy `primary` esa 2.98:1 (fonga qo'shilib ketadi).
    'bg-primary text-white border border-primary hover:bg-primary-hover active:bg-primary-pressed font-semibold shadow-cta dark:bg-primary-on-dark dark:border-primary-on-dark dark:hover:bg-primary dark:active:bg-primary-hover',
  secondary:
    'bg-surface-2 text-ink border border-line hover:bg-surface-3 hover:border-line-strong font-semibold',
  danger:
    'bg-danger/12 text-danger-deep dark:text-danger-light border border-danger/40 hover:bg-danger/20 font-semibold',
  ghost: 'bg-transparent text-muted border border-transparent hover:bg-surface-2 hover:text-ink',
  outline:
    'bg-transparent text-muted border border-line hover:bg-surface-2 hover:border-line-strong hover:text-ink',
  override:
    'bg-override/12 text-override-dark dark:text-override-light border border-override/40 hover:bg-override/20 font-semibold',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-caption rounded-ds-xs gap-1.5',
  md: 'px-4 py-2.5 text-label rounded-ds-sm gap-2',
  lg: 'px-5 py-3 text-title rounded-ds-md gap-2',
  /** Oshxona ekrani: barmoq bilan bosiladi — WCAG 2.5.5 (44px). */
  kitchen: 'px-5 py-3.5 text-title rounded-ds-md gap-2.5 min-h-touch',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={clsx(
        'inline-flex items-center justify-center whitespace-nowrap select-none',
        'transition-colors duration-fast ease-standard',
        // Fokus halqasi global `:focus-visible` dan keladi (2px + 2px offset) —
        // shuning uchun bu yerda outline o'chirilmaydi.
        'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted',
        'disabled:border-line disabled:shadow-none disabled:hover:bg-surface-2',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : leftIcon ? (
        <span className="shrink-0" aria-hidden>
          {leftIcon}
        </span>
      ) : null}
      {children}
      {!isLoading && rightIcon && (
        <span className="shrink-0" aria-hidden>
          {rightIcon}
        </span>
      )}
    </button>
  )
);

Button.displayName = 'Button';

export { Button };
