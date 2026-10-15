import { BarChart3 } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { EmptyState } from '@/components/ui/EmptyState';

export interface BarDatum {
  key: string;
  /** X o'qi yozuvi (11px). Bo'sh qator — yozuv chiqmaydi (zich o'q). */
  label: string;
  value: number;
  /** Ekran o'quvchi va tooltip uchun to'liq qiymat ("Dush: 120 000 soʻm"). */
  title: string;
}

export interface BarChartProps {
  data: readonly BarDatum[];
  /** Y o'qi yozuvlari formatlovchisi. */
  formatTick: (value: number) => string;
  /** Ajratib ko'rsatiladigan ustun (masalan, eng band soat). */
  highlightKey?: string | null;
  heightClassName?: string;
  ariaLabel: string;
  /** Kamida shuncha nuqta bo'lmasa grafik chizilmaydi (PANEL-UI-KIT §6). */
  minPoints?: number;
}

const TICKS = 4;

/** Y o'qi uchun "chiroyli" yuqori chegara: 1/2/2.5/5 × 10^n. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/**
 * Oddiy vertikal ustunli grafik (§6): ustun kengligi max 32px, faqat
 * gorizontal `line` chiziqlar, o'qlar 11px `text-subtle`. Nuqtalar < 3 bo'lsa
 * grafik o'rniga bo'sh holat — bitta ulkan ustun yolg'on taassurot beradi.
 */
export function BarChart({
  data,
  formatTick,
  highlightKey,
  heightClassName = 'h-48',
  ariaLabel,
  minPoints = 3,
}: BarChartProps) {
  const nonZero = data.filter((d) => d.value > 0).length;
  if (data.length < minPoints || nonZero === 0) {
    return (
      <EmptyState
        compact
        variant="first-use"
        icon={<BarChart3 size={20} />}
        title={nonZero === 0 ? 'Bu davrda maʼlumot yoʻq' : 'Grafik uchun maʼlumot yetarli emas'}
        description="Buyurtmalar koʻpaygach grafik toʻladi."
      />
    );
  }

  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (max / TICKS) * (TICKS - i));

  return (
    <figure aria-label={ariaLabel} className="flex gap-2">
      {/* Y o'qi */}
      <div className={cn('flex shrink-0 flex-col justify-between text-right', heightClassName)} aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="num -my-1.5 text-[11px] leading-3 text-subtle">
            {formatTick(t)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className={cn('relative', heightClassName)}>
          {/* Faqat gorizontal grid chiziqlar */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="h-px w-full bg-line" />
            ))}
          </div>
          <ul className="relative flex h-full items-end gap-1">
            {data.map((d) => (
              <li key={d.key} className="flex h-full flex-1 items-end justify-center">
                <div
                  role="img"
                  aria-label={d.title}
                  title={d.title}
                  className={cn(
                    'w-full max-w-[32px] rounded-t-[3px] transition-colors',
                    d.key === highlightKey ? 'bg-primary dark:bg-primary-on-dark' : 'bg-primary/45 hover:bg-primary/70'
                  )}
                  style={{ height: d.value > 0 ? `${Math.max(1, (d.value / max) * 100)}%` : 0 }}
                />
              </li>
            ))}
          </ul>
        </div>
        {/* X o'qi */}
        <div className="mt-1.5 flex gap-1" aria-hidden>
          {data.map((d) => (
            <span
              key={d.key}
              className={cn(
                'num flex-1 truncate text-center text-[11px]',
                d.key === highlightKey ? 'font-semibold text-ink' : 'text-subtle'
              )}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
