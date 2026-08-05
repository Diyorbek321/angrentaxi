import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

/**
 * KPI karta. Ikonka konteyneri AKSENT qatlam (tinted yuza + `*-deep` ikonka),
 * hech qachon interaktiv `primary` fon emas — karta bosiladigan element emas.
 *
 * Eski variant nomlari (`yellow`/`blue`/`green`/`purple`) saqlanadi, lekin
 * ular endi mint tizimidagi semantik ohanglarga taqqoslanadi, shunda mavjud
 * chaqiruv joylarini bir vaqtning o'zida o'zgartirish shart emas.
 */
type StatVariant = 'mint' | 'info' | 'violet' | 'override' | 'danger' | 'neutral'
  // Migratsiya davri uchun aliaslar.
  | 'yellow' | 'blue' | 'green' | 'purple';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: StatVariant;
  trend?: {
    value: number;
    label: string;
  };
  isLoading?: boolean;
  className?: string;
}

const toneConfig: Record<StatVariant, { icon: string; accent: string }> = {
  // `mint-tint` fon + `primary-text` ikonka — yorug' fonda ham 4.95:1.
  mint: { icon: 'bg-mint-tint text-primary-text', accent: 'bg-mint-deep' },
  green: { icon: 'bg-mint-tint text-primary-text', accent: 'bg-mint-deep' },
  info: { icon: 'bg-info-tint text-info-deep dark:text-info-light', accent: 'bg-info' },
  blue: { icon: 'bg-info-tint text-info-deep dark:text-info-light', accent: 'bg-info' },
  violet: { icon: 'bg-violet-tint text-violet-deep dark:text-violet-light', accent: 'bg-violet' },
  purple: { icon: 'bg-violet-tint text-violet-deep dark:text-violet-light', accent: 'bg-violet' },
  override: {
    icon: 'bg-override-tint text-override-dark dark:text-override-light',
    accent: 'bg-override',
  },
  yellow: {
    icon: 'bg-override-tint text-override-dark dark:text-override-light',
    accent: 'bg-override',
  },
  danger: { icon: 'bg-danger-tint text-danger-deep dark:text-danger-light', accent: 'bg-danger' },
  neutral: { icon: 'bg-surface-2 text-muted', accent: 'bg-line-strong' },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'mint',
  trend,
  isLoading,
  className,
}: StatCardProps) {
  const tone = toneConfig[variant] ?? toneConfig.mint;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-ds-md border border-line bg-surface p-5 shadow-card',
        'transition-colors duration-fast ease-standard hover:border-line-strong',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-body text-muted">{title}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className="mt-2 font-mono text-display tabular-nums text-ink">{value}</p>
          )}
          {subtitle && !isLoading && <p className="mt-1 text-caption text-subtle">{subtitle}</p>}
          {trend && !isLoading && (
            <div className="mt-2 flex items-center gap-1">
              {/* Ma'no faqat rang bilan emas — o'q belgisi va ishora so'zi ham bor. */}
              <span
                className={cn(
                  'text-caption font-semibold',
                  trend.value >= 0
                    ? 'text-primary-text'
                    : 'text-danger-deep dark:text-danger-light'
                )}
              >
                <span aria-hidden="true">{trend.value >= 0 ? '▲' : '▼'} </span>
                <span className="sr-only">{trend.value >= 0 ? 'oshdi' : 'kamaydi'} </span>
                {Math.abs(trend.value)}%
              </span>
              <span className="text-caption text-subtle">{trend.label}</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-ds-sm',
            tone.icon
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>

      {/* Pastki aksent chizig'i — dekorativ, ma'no tashimaydi. */}
      <span
        className={cn('absolute bottom-0 left-0 h-[2px] w-full opacity-70', tone.accent)}
        aria-hidden="true"
      />
    </div>
  );
}
