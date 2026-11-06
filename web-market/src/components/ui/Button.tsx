// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from './cn';

/**
 * Canonical variants: primary · secondary · ghost · danger · danger-ghost ·
 * override (amber — deliberate human intervention ONLY) · link.
 * Legacy aliases (kept so every panel compiles): default→primary,
 * success→primary, destructive→danger, outline→secondary.
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'danger-ghost'
  | 'override'
  | 'link'
  | 'default'
  | 'success'
  | 'destructive'
  | 'outline';

/** sm 28px · md 32px · lg 40px · icon 32□ · icon-sm 28□ · kitchen 44px touch. `default` = md. */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'kitchen' | 'default';

type CanonicalVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost' | 'override' | 'link';

const VARIANT_ALIAS: Record<ButtonVariant, CanonicalVariant> = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'danger',
  'danger-ghost': 'danger-ghost',
  override: 'override',
  link: 'link',
  default: 'primary',
  success: 'primary',
  destructive: 'danger',
  outline: 'secondary',
};

// No glow, no gradient. Hairline borders; fills only for primary/danger.
const variantClasses: Record<CanonicalVariant, string> = {
  primary:
    'bg-primary text-white border border-primary hover:bg-primary-hover hover:border-primary-hover active:bg-primary-pressed dark:bg-primary-on-dark dark:border-primary-on-dark dark:hover:bg-primary',
  secondary:
    'bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong active:bg-surface-3 shadow-[0_1px_1px_rgb(15_27_34/0.04)]',
  ghost: 'bg-transparent text-muted border border-transparent hover:bg-surface-2 hover:text-ink active:bg-surface-3',
  danger:
    'bg-danger-dark text-white border border-danger-dark hover:bg-[#991B1B] hover:border-[#991B1B] dark:bg-danger dark:border-danger',
  'danger-ghost':
    'bg-transparent text-danger-dark dark:text-danger-light border border-transparent hover:bg-danger-tint',
  override:
    'bg-override-tint text-override-dark dark:text-override-light border border-override/50 hover:bg-override/20',
  link: 'bg-transparent text-primary-text border border-transparent px-0 h-auto underline-offset-4 hover:underline',
};

const sizeClasses: Record<Exclude<ButtonSize, 'default'>, string> = {
  sm: 'h-7 px-2.5 text-[13px] gap-1.5 rounded-ds-sm',
  md: 'h-8 px-3 text-[13px] gap-1.5 rounded-ds-sm',
  lg: 'h-10 px-4 text-sm gap-2 rounded-ds-sm',
  icon: 'h-8 w-8 p-0 rounded-ds-sm',
  'icon-sm': 'h-7 w-7 p-0 rounded-ds-sm',
  kitchen: 'min-h-touch px-5 text-base gap-2 rounded-ds-md',
};

export interface ButtonVariantOptions {
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  fullWidth?: boolean;
  className?: string;
}

/** Class string for a button look (e.g. on a `<Link>`); cva-compatible call shape. */
export function buttonVariants({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonVariantOptions = {}): string {
  const v = VARIANT_ALIAS[variant ?? 'primary'];
  const s = !size || size === 'default' ? 'md' : size;
  return cn(
    'inline-flex items-center justify-center whitespace-nowrap font-medium select-none transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none',
    '[&_svg]:shrink-0',
    sizeClasses[s],
    variantClasses[v],
    fullWidth && 'w-full',
    className
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** Alias of `isLoading`. */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  /**
   * Render as a link with the button look. App routes → Next.js `<Link>`;
   * `tel:` / `mailto:` / `sms:` / `http(s)://` (or `external`) → plain `<a>`.
   */
  href?: string;
  /** Force a plain `<a>` opening in a new tab (rel="noopener noreferrer"). */
  external?: boolean;
}

const PLAIN_HREF = /^(tel:|mailto:|sms:|https?:\/\/)/i;

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      href,
      external = false,
      className,
      disabled,
      children,
      type,
      ...props
    },
    ref
  ) => {
    const busy = isLoading || loading;
    const classes = buttonVariants({ variant, size, fullWidth, className });
    const content = (
      <>
        {busy ? <Spinner /> : leftIcon ? <span className="inline-flex shrink-0">{leftIcon}</span> : null}
        {children}
        {!busy && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </>
    );

    if (href && !disabled && (external || PLAIN_HREF.test(href))) {
      const newTab = external || /^https?:/i.test(href);
      return (
        <a
          href={href}
          className={classes}
          aria-label={props['aria-label']}
          title={props.title}
          onClick={props.onClick as never}
          target={newTab ? '_blank' : undefined}
          rel={newTab ? 'noopener noreferrer' : undefined}
        >
          {content}
        </a>
      );
    }

    if (href && !disabled) {
      return (
        <Link
          href={href}
          className={classes}
          aria-label={props['aria-label']}
          title={props.title}
          onClick={props.onClick as never}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        className={classes}
        {...props}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
