import { AlarmClock, CalendarClock, Timer } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import type { PrepTimer } from '@/lib/format';

const tone: Record<PrepTimer['state'], string> = {
  ok: 'border-line bg-surface-2 text-ink',
  // Info, not amber: amber is reserved for human override (PANEL-UI-KIT).
  soon: 'border-info/40 bg-info-tint text-info-dark dark:text-info-light',
  late: 'border-danger/40 bg-danger-tint text-danger-dark dark:text-danger-light',
  stale: 'border-line bg-surface-2 text-muted',
};

/**
 * Tayyorlash taymeri. Ma'no faqat rang bilan emas — ikonka va yozuv bilan
 * ham ("Kechikmoqda · …"). Raqamlar sans + tabular (`.num`), mono EMAS.
 */
export function PrepTimerChip({ timer, large = false }: { timer: PrepTimer; large?: boolean }) {
  const Icon = timer.state === 'late' ? AlarmClock : timer.state === 'stale' ? CalendarClock : Timer;
  return (
    <span
      role="timer"
      aria-label={timer.label}
      title={timer.label}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-ds-sm border font-semibold',
        large ? 'h-10 px-3 text-h3' : 'h-7 px-2 text-[13px]',
        tone[timer.state]
      )}
    >
      <Icon size={large ? 18 : 14} aria-hidden />
      <span className="num">{timer.text}</span>
    </span>
  );
}
