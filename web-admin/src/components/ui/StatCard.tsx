import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

/**
 * KPI karta — 4 qatlamli anatomiya (manager-panel doktrina):
 *   yorliq → katta qiymat (`tabular-nums`) → taqqoslash deltasi → sparkline.
 *
 * MUHIM: `trend` (delta) FAQAT API haqiqiy o'tgan-davr ma'lumotini berganda
 * uzatiladi. Hozirgi `/orders/stats` javobida o'tgan davr YO'Q — shuning
 * uchun dashboard deltasiz, `subtitle` kontekst qatori bilan ishlaydi.
 * Delta hech qachon o'ylab topilmaydi. `sparkline` ham faqat haqiqiy
 * seriyadan (masalan, hisobotlar API'sining 7 kunlik qatoridan) chiziladi.
 *
 * Ikonka konteyneri AKSENT qatlam (tinted yuza + `*-deep` ikonka),
 * hech qachon interaktiv `primary` fon emas — karta bosiladigan element emas.
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
  /**
   * Taqqoslash deltasi — faqat o'tgan davr ma'lumoti API'dan kelganda.
   * `positiveIsGood: false` — "kamaygani yaxshi" metrikalar uchun
   * (bekor qilishlar, kutish vaqti): rang shunga qarab teskarilanadi.
   */
  trend?: {
    value: number;
    label: string;
    positiveIsGood?: boolean;
  };
  /** Haqiqiy seriya (masalan, oxirgi 7 kun) — dekorativ mini-trend. */
  sparkline?: number[];
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

/** Mayda polilinya — currentColor bilan chiziladi, ikkala temada ishlaydi. */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const width = 120;
  const height = 28;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = pad + (i * (width - pad * 2)) / (data.length - 1);
      const y = height - pad - ((v - min) * (height - pad * 2)) / span;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-full text-primary-text"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'mint',
  trend,
  sparkline,
  isLoading,
  className,
}: StatCardProps) {
  const tone = toneConfig[variant] ?? toneConfig.mint;
  const positiveIsGood = trend?.positiveIsGood ?? true;
  const isGood = trend ? (trend.value >= 0) === positiveIsGood : true;

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
          {/* 1-qatlam: yorliq */}
          <p className="text-body text-muted">{title}</p>

          {/* 2-qatlam: katta qiymat */}
          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className="mt-2 font-mono text-display tabular-nums text-ink">{value}</p>
          )}

          {/* 3-qatlam: delta (faqat haqiqiy taqqoslash bo'lsa) yoki kontekst */}
          {trend && !isLoading && (
            <div className="mt-2 flex items-center gap-1">
              {/* Ma'no faqat rang bilan emas — o'q belgisi va ishora so'zi ham bor.
                  Yashil = YAXSHI (pastga tushishi yaxshi metrikada teskarilanadi). */}
              <span
                className={cn(
                  'text-caption font-semibold tabular-nums',
                  isGood ? 'text-primary-text' : 'text-danger-deep dark:text-danger-light'
                )}
              >
                <span aria-hidden="true">{trend.value >= 0 ? '▲' : '▼'} </span>
                <span className="sr-only">{trend.value >= 0 ? 'oshdi' : 'kamaydi'} </span>
                {Math.abs(trend.value)}%
              </span>
              <span className="text-caption text-subtle">{trend.label}</span>
            </div>
          )}
          {subtitle && !isLoading && !trend && (
            <p className="mt-1 text-caption text-subtle">{subtitle}</p>
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

      {/* 4-qatlam: sparkline — faqat haqiqiy seriya kelganda */}
      {sparkline && sparkline.length > 1 && !isLoading && (
        <div className="mt-3">
          <Sparkline data={sparkline} />
        </div>
      )}

      {/* Pastki aksent chizig'i — dekorativ, ma'no tashimaydi. */}
      <span
        className={cn('absolute bottom-0 left-0 h-[2px] w-full opacity-70', tone.accent)}
        aria-hidden="true"
      />
    </div>
  );
}
