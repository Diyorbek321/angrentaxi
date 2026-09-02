'use client';

import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /**
   * `danger` — yoqilishi XAVFLI rejimni bildiradigan switch (masalan,
   * texnik profilaktika). Oddiy faol/nofaol holat uchun `primary`.
   */
  tone?: 'primary' | 'danger';
  'aria-label'?: string;
  className?: string;
}

/**
 * Inline holat almashtirgich — jadval qatoridagi faol/nofaol kabi QAYTARILADIGAN
 * amallar uchun. Tasdiqlash modali shart emas (doktrina: modal faqat
 * destruktiv/moliyaviy amalga); natija toast bilan aytiladi.
 *
 * Tugmacha ikkala temada ham oq: yo'lakcha yo `primary` (oq bilan 5.38:1),
 * yo `surface-3` + kuchli chegara — tokenli matn yuzasi bu yerda ko'rinmay
 * qolardi (global-settings dagi izohga qarang).
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  tone = 'primary',
  'aria-label': ariaLabel,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-fast ease-standard',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Chegara ikkala holatda ham bor (yoqilganda shaffof) — aks holda
        // absolute tugmacha 1px "sakraydi".
        'border',
        checked
          ? tone === 'danger'
            ? 'border-transparent bg-danger'
            : 'border-transparent bg-primary dark:bg-primary-on-dark'
          : 'border-line-strong bg-surface-3',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-transform duration-fast ease-standard',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}
