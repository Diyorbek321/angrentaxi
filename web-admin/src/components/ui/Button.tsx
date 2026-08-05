import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Angren Mint — ikki qatlamli brend modeli (docs/DESIGN-TOKENS.md §3.1/3.1b).
 *
 *   INTERAKTIV to'ldirish  → `bg-primary` (#0C7A4D) + `text-white` (5.38:1)
 *   AKSENT/dekorativ       → `bg-mint` (#1FCA8E) + `text-mint-on`
 *
 * Tugma har doim interaktiv, shuning uchun bu yerda `mint` FON sifatida
 * ishlatilmaydi — `bg-mint` + `text-white` atigi 2.12:1 beradi.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-nowrap rounded-ds-md text-sm font-semibold',
    'transition-colors duration-fast ease-standard',
    // Fokus halqasi: 2px qalinlik + 2px offset (WCAG 2.4.7 / 1.4.11).
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        /** Asosiy harakat — to'q yashil fon, OQ matn. */
        default: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-pressed shadow-cta dark:bg-primary-on-dark dark:hover:bg-primary',
        primary: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-pressed shadow-cta dark:bg-primary-on-dark dark:hover:bg-primary',
        destructive: 'bg-danger-tint text-danger-deep dark:text-danger-light border border-danger/40 hover:bg-danger/20 focus-visible:ring-danger',
        danger: 'bg-danger-tint text-danger-deep dark:text-danger-light border border-danger/40 hover:bg-danger/20 focus-visible:ring-danger',
        outline: 'border border-line bg-transparent text-muted hover:bg-surface-2 hover:border-line-strong hover:text-ink',
        secondary: 'bg-surface-2 text-ink border border-line hover:bg-surface-3 hover:border-line-strong',
        ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
        link: 'text-primary-text underline-offset-4 hover:underline',
        /** Muvaffaqiyat = brend yashili, alohida yashil kiritilmaydi. */
        success: 'bg-mint-tint text-primary-text border border-mint/40 hover:bg-mint/20',
        /** Qo'lda aralashuv — amber faqat shu ma'no uchun. */
        override: 'bg-override-tint text-override-dark dark:text-override-light border border-override/40 hover:bg-override/20 focus-visible:ring-override',
      },
      size: {
        default: 'h-10 px-4 py-2 gap-2',
        sm: 'h-8 rounded-ds-sm px-3 text-xs gap-1.5',
        lg: 'h-12 px-8 text-base gap-2',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8 rounded-ds-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, isLoading, leftIcon, rightIcon, children, disabled, ...props },
    ref
  ) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <svg
            className="h-4 w-4 shrink-0 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
