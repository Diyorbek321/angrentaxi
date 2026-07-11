import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'orange';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-white/10 text-[#94A3B8] border border-white/10',
  primary: 'bg-[#FACC15]/15 text-[#FACC15] border border-[#FACC15]/20',
  success: 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20',
  warning: 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/20',
  danger: 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/20',
  info: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  orange: 'bg-orange-500/15 text-orange-400 border border-orange-500/20',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center font-medium rounded-full',
          variantClasses[variant],
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
