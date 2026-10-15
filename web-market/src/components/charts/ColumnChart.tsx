import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMoney, formatNumber } from '@/lib/format';

export interface ColumnDatum {
  label: string;
  value: number;
}

const MIN_POINTS = 3;
const TICKS = 4;

/** O'q yozuvi uchun qisqa son: 1 250 000 → "1,3 mln", 45 000 → "45 ming". */
function compact(n: number): string {
  if (n >= 1_000_000) return `${formatNumber(n / 1_000_000, n % 1_000_000 === 0 ? 0 : 1)} mln`;
  if (n >= 1_000) return `${formatNumber(Math.round(n / 1_000))} ming`;
  return formatNumber(n);
}

/** Yaxlit shkala yuqorisi: 87 400 → 100 000. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= max) ?? 10;
  return step * pow;
}

/**
 * Ustunli grafik (PANEL-UI-KIT §6): ustun ≤ 32px, faqat gorizontal grid
 * chiziqlari `line` rangida, o'qlar 11px `text-subtle`. Nuqta < 3 bo'lsa —
 * grafik o'rniga bo'sh holat (bitta ulkan ustun yolg'on taassurot beradi).
 * Ekran o'quvchi uchun yashirin jadval ham chiziladi.
 */
export function ColumnChart({
  data,
  ariaLabel,
  highlightMax = true,
}: {
  data: ColumnDatum[];
  ariaLabel: string;
  highlightMax?: boolean;
}) {
  if (data.length < MIN_POINTS) {
    return (
      <EmptyState
        compact
        icon={<BarChart3 aria-hidden />}
        title="Grafik uchun maʼlumot yetarli emas"
        description="Kamida 3 kunlik savdo kerak."
      />
    );
  }

  const rawMax = Math.max(...data.map((d) => d.value));
  const top = niceMax(rawMax);
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (top / TICKS) * (TICKS - i));

  return (
    <figure aria-label={ariaLabel} className="m-0">
      <div className="flex gap-2" aria-hidden>
        <div className="relative h-44 w-14 shrink-0">
          {ticks.map((t, i) => (
            <span
              key={t}
              style={{ top: `${(i / TICKS) * 100}%` }}
              className="num absolute right-0 -translate-y-1/2 text-[11px] leading-none text-subtle"
            >
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative h-44 flex-1">
          <div className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((t) => (
              <span key={t} className="block h-px w-full bg-line" />
            ))}
          </div>
          <div className="absolute inset-0 flex items-end justify-around gap-2">
            {data.map((d, i) => (
              <div
                key={`${d.label}-${i}`}
                title={`${d.label}: ${formatMoney(d.value)}`}
                className={
                  highlightMax && d.value === rawMax && rawMax > 0
                    ? 'w-full max-w-[32px] rounded-t-[3px] bg-primary dark:bg-mint-deep'
                    : 'w-full max-w-[32px] rounded-t-[3px] bg-primary/45 dark:bg-mint-deep/50'
                }
                style={{ height: `${d.value > 0 ? Math.max(1, (d.value / top) * 100) : 0}%` }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-2" aria-hidden>
        <span className="w-14 shrink-0" />
        <div className="flex flex-1 justify-around gap-2">
          {data.map((d, i) => (
            <span key={`${d.label}-${i}`} className="w-full max-w-[48px] truncate text-center text-[11px] text-subtle">
              {d.label}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-${i}`}>
              <th scope="row">{d.label}</th>
              <td>{formatMoney(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
