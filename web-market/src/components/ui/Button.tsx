import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-ink hover:bg-primary-light active:bg-primary-dark font-semibold border border-primary shadow-glow-mint-sm focus-visible:ring-primary',
  secondary:
    'bg-surface-2 text-ink hover:bg-surface-3 border border-line hover:border-line-strong focus-visible:ring-primary',
  ghost:
    'bg-transparent text-muted hover:bg-surface-2 hover:text-ink border border-transparent focus-visible:ring-primary',
  outline:
    'bg-transparent border border-line text-muted hover:bg-surface-2 hover:border-line-strong hover:text-ink focus-visible:ring-primary',
  // Destructive only — deleting a product or a category.
  danger:
    'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/30 font-semibold focus-visible:ring-danger',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-3.5 py-2 text-sm rounded-lg gap-2',
  lg: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  icon: 'h-10 w-10 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-lg',
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
      type = 'button',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap transition-colors',
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
