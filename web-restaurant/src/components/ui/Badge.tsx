import { HTMLAttributes, ReactNode, forwardRef } from 'react';
import { clsx } from 'clsx';

/**
 * Badge — AKSENT qatlam. Foni har doim tint/shaffof, yozuvi esa
 * `*-deep` (yorug' tema) yoki `*-light` (qorong'i tema) — DEFAULT semantik
 * rang matn uchun ishlatilmaydi (DESIGN-TOKENS 7.2.4).
 */
export type BadgeVariant =
  | 'default'
  /** Brend aksenti — mint tint + temaga mos yashil yozuv. */
  | 'mint'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'violet';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-2 text-muted border-line',
  mint: 'bg-mint-tint text-primary-text border-mint/35',
  success: 'bg-mint-tint text-primary-text border-mint/35',
  warning: 'bg-override-tint text-override-dark dark:text-override-light border-override/40',
  danger: 'bg-danger-tint text-danger-deep dark:text-danger-light border-danger/40',
  info: 'bg-info-tint text-info-deep dark:text-info-light border-info/40',
  violet: 'bg-violet-tint text-violet-deep dark:text-violet-light border-violet/40',
};

const dotClasses: Record<BadgeVariant, string> = {
  // Yorug' fonda ko'rinishi shart bo'lgan nuqta hech qachon `mint` emas —
  // `mint-deep` (3.37:1). DESIGN-TOKENS 2.1.
  default: 'bg-subtle',
  mint: 'bg-mint-deep',
  success: 'bg-mint-deep',
  warning: 'bg-override',
  danger: 'bg-danger',
  info: 'bg-info',
  violet: 'bg-violet',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  /** Oldingi nuqta — jonli status chirog'idek o'qiladi. */
  dot?: boolean;
  /** Ikonka — ma'no faqat rangga tayanmasligi uchun. */
  icon?: ReactNode;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', dot = false, icon, className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={clsx(
        'inline-flex items-center gap-1.5 font-bold rounded-full whitespace-nowrap border',
        variantClasses[variant],
        size === 'sm'
          ? 'px-2 py-0.5 text-micro'
          : size === 'lg'
            ? 'px-3.5 py-1.5 text-label'
            : 'px-2.5 py-1 text-caption',
        className
      )}
      {...props}
    >
      {dot && <span className={clsx('h-2 w-2 rounded-full shrink-0', dotClasses[variant])} aria-hidden />}
      {icon && (
        <span className="shrink-0 inline-flex" aria-hidden>
          {icon}
        </span>
      )}
      {children}
    </span>
  )
);

Badge.displayName = 'Badge';

export { Badge };
