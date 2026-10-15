'use client';

import { cn } from '@/components/ui/cn';

export interface OpenToggleProps {
  isOpen: boolean;
  /** Restoran hali yuklanmagan — holatni taxmin qilmaymiz. */
  unknown?: boolean;
  busy: boolean;
  onToggle: () => void;
  /** Oshxona ekrani: kattaroq tegish maydoni. */
  large?: boolean;
}

/**
 * Ochiq/Yopiq (pauza) boshqaruvi — topbarda, bitta bosish. Holat rang + nuqta
 * + YOZUV bilan beriladi; yopiq holat qizil — jim turgan pauza "mijoz yo'q"
 * kabi ko'rinmasligi kerak.
 */
export function OpenToggle({ isOpen, unknown = false, busy, onToggle, large = false }: OpenToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy || unknown}
      aria-pressed={unknown ? undefined : isOpen}
      title={isOpen ? 'Qabulni yopish (pauza)' : 'Qabulni ochish'}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-ds-sm border font-medium whitespace-nowrap transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60',
        large ? 'h-11 px-4 text-body' : 'h-8 px-2.5 text-[13px]',
        unknown
          ? 'border-line bg-surface text-muted'
          : isOpen
            ? 'border-line bg-surface text-ink hover:bg-surface-2'
            : 'border-danger/40 bg-danger-tint text-danger-dark hover:bg-danger-tint/70 dark:text-danger-light'
      )}
    >
      <span
        aria-hidden
        className={cn('h-2 w-2 rounded-full', unknown ? 'bg-subtle' : isOpen ? 'bg-mint-deep' : 'bg-danger')}
      />
      {unknown ? 'Restoran' : isOpen ? 'Ochiq' : 'Yopiq'}
      <span className="sr-only">{unknown ? '' : isOpen ? '— yopish uchun bosing' : '— ochish uchun bosing'}</span>
    </button>
  );
}
