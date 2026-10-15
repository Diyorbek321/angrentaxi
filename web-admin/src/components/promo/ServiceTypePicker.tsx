'use client';

import {
  PROMO_SERVICE_TYPES,
  PROMO_SERVICE_TYPE_LABELS,
  coversAllServices,
  toggleServiceType,
  type PromoServiceType,
} from '@/lib/promo-service-types';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';

/** Promokod xizmat turlari — ko'p tanlov; hech biri tanlanmasa = hammasi. */
export function ServiceTypePicker({
  value,
  onChange,
  disabled,
}: {
  value: PromoServiceType[];
  onChange: (next: PromoServiceType[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-[13px] font-medium text-ink">Xizmatlar</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {PROMO_SERVICE_TYPES.map((type) => (
          <Checkbox
            key={type}
            checked={value.includes(type)}
            onCheckedChange={() => onChange(toggleServiceType(value, type))}
            label={PROMO_SERVICE_TYPE_LABELS[type]}
          />
        ))}
      </div>
      <p className="text-xs text-muted">
        {coversAllServices(value)
          ? 'Hech biri tanlanmagan — barcha xizmatlarda amal qiladi'
          : 'Faqat tanlangan xizmatlarda amal qiladi'}
      </p>
    </fieldset>
  );
}

/** Jadval katakchasi: "Hammasi" yoki xizmat badge'lari. */
export function ServiceTypesCell({ value }: { value: readonly unknown[] | null | undefined }) {
  if (coversAllServices(value)) return <span className="text-muted">Hammasi</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {PROMO_SERVICE_TYPES.filter((t) => (value ?? []).includes(t)).map((t) => (
        <Badge key={t} variant="neutral" size="sm">
          {PROMO_SERVICE_TYPE_LABELS[t]}
        </Badge>
      ))}
    </span>
  );
}
