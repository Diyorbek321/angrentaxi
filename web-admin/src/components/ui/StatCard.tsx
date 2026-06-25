import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

type StatVariant = 'yellow' | 'blue' | 'green' | 'purple';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg?: string;
  variant?: StatVariant;
  trend?: {
    value: number;
    label: string;
  };
  isLoading?: boolean;
  className?: string;
}

const variantConfig: Record<StatVariant, {
  iconGradient: string;
  glowColor: string;
  borderAccent: string;
  hoverShadow: string;
}> = {
  yellow: {
    iconGradient: 'bg-stat-gradient-1',
    glowColor: 'rgba(250,204,21,0.15)',
    borderAccent: 'border-yellow-400/50',
    hoverShadow: '0 8px 32px rgba(250,204,21,0.08)',
  },
  blue: {
    iconGradient: 'bg-stat-gradient-2',
    glowColor: 'rgba(59,130,246,0.15)',
    borderAccent: 'border-blue-500/50',
    hoverShadow: '0 8px 32px rgba(59,130,246,0.08)',
  },
  green: {
    iconGradient: 'bg-stat-gradient-3',
    glowColor: 'rgba(16,185,129,0.15)',
    borderAccent: 'border-green-500/50',
    hoverShadow: '0 8px 32px rgba(16,185,129,0.08)',
  },
  purple: {
    iconGradient: 'bg-stat-gradient-4',
    glowColor: 'rgba(139,92,246,0.15)',
    borderAccent: 'border-purple-500/50',
    hoverShadow: '0 8px 32px rgba(139,92,246,0.08)',
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'yellow',
  trend,
  isLoading,
  className,
}: StatCardProps) {
  const config = variantConfig[variant];

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[#0D1526] border border-white/[0.08] rounded-2xl p-6',
        'transition-all duration-200 group',
        className
      )}
      style={{
        ['--hover-shadow' as string]: config.hoverShadow,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = config.hoverShadow;
        (e.currentTarget as HTMLElement).style.borderColor = config.glowColor;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '';
        (e.currentTarget as HTMLElement).style.borderColor = '';
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-400">{title}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-32 bg-white/10" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          )}
          {subtitle && !isLoading && (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          )}
          {trend && !isLoading && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  'text-xs font-medium',
                  trend.value >= 0 ? 'text-green-400' : 'text-red-400'
                )}
              >
                {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-slate-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            config.iconGradient
          )}
        >
          {icon}
        </div>
      </div>

      {/* Bottom accent line */}
      <div
        className={cn(
          'absolute bottom-0 left-0 h-[2px] w-full border-t-2',
          config.borderAccent
        )}
      />
    </div>
  );
}
