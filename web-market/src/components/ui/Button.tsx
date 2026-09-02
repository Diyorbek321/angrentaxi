import { forwardRef, ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'outline'
  /** Deliberate human intervention. Amber is reserved for this — never for
   *  ordinary actions, so an override always reads as "a person stepped in". */
  | 'override';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover active:bg-primary-pressed font-semibold border border-primary shadow-glow-primary focus:ring-focus',
  secondary:
    'bg-surface-2 text-ink hover:bg-surface-3 border border-line hover:border-line-strong focus:ring-primary',
  danger:
    'bg-danger/10 text-danger-deep dark:text-danger-light hover:bg-danger/20 border border-danger/30 focus:ring-danger',
  ghost:
    'bg-transparent text-muted hover:bg-surface-2 hover:text-ink border border-transparent focus:ring-primary',
  outline:
    'bg-transparent border border-line text-muted hover:bg-surface-2 hover:border-line-strong hover:text-ink focus:ring-primary',
  override:
    'bg-override/12 text-override-dark dark:text-override-light hover:bg-override/20 border border-override/40 font-semibold focus:ring-override',
};

/**
 * Boshqaruv balandligi izchil shkala: 32 / 40 / 48 px. Input va Select ham
 * `md` bilan bir xil 40px — yonma-yon turganda tekis chiziq hosil bo'ladi.
 */
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs rounded-ds-xs gap-1.5',
  md: 'h-10 px-3.5 text-sm rounded-ds-xs gap-2',
  lg: 'h-12 px-5 text-sm rounded-ds-sm gap-2',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          'inline-flex items-center justify-center whitespace-nowrap transition-colors tabular-nums',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          'disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none',
          variantClasses[variant],
          sizeClasses[size],
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
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : leftIcon ? (
          <span className="shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
