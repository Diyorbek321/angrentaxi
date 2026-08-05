import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Badge — AKSENT qatlam. Fon `mint`/tint, matn esa `*-deep` (yorug' tema) yoki
 * `*-light` (qorong'i tema); `text-white` + mint fon HECH QACHON (2.12:1).
 *
 * `dot` — ma'no faqat rang orqali berilmasligi uchun emas, balki qo'shimcha
 * ko'rsatkich sifatida; badge matni har doim holatni so'z bilan ham aytadi.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
  {
    variants: {
      variant: {
        default: 'bg-mint-tint text-primary-text border border-mint/30',
        primary: 'bg-mint-tint text-primary-text border border-mint/30',
        secondary: 'bg-surface-2 text-muted border border-line',
        outline: 'border border-line-strong text-muted',
        destructive: 'bg-danger-tint text-danger-deep dark:text-danger-light border border-danger/30',
        danger: 'bg-danger-tint text-danger-deep dark:text-danger-light border border-danger/30',
        /** success = brend yashili; alohida yashil kiritilmaydi. */
        success: 'bg-mint-tint text-primary-text border border-mint/30',
        warning: 'bg-override-tint text-override-dark dark:text-override-light border border-override/30',
        override: 'bg-override-tint text-override-dark dark:text-override-light border border-override/40',
        info: 'bg-info-tint text-info-deep dark:text-info-light border border-info/30',
        violet: 'bg-violet-tint text-violet-deep dark:text-violet-light border border-violet/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Yetakchi nuqta — jonli status chirog'i sifatida o'qiladi. */
  dot?: boolean;
}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
