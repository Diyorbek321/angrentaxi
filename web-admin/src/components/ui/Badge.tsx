import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/30',
        secondary: 'bg-white/10 text-slate-300 border border-white/20',
        destructive: 'bg-red-500/15 text-red-400 border border-red-500/30',
        success: 'bg-green-500/15 text-green-400 border border-green-500/30',
        warning: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
        info: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
        outline: 'border border-white/20 text-slate-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
