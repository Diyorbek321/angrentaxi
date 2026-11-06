'use client';

import {
  PROMO_SERVICE_TYPES,
  promoServiceTypeLabels,
  coversAllServices,
  toggleServiceType,
  type PromoServiceType,
} from '@/lib/promo-service-types';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { t } from '@/locales';

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
  const pm = t().ops.promo.services;
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-[13px] font-medium text-ink">{pm.legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {PROMO_SERVICE_TYPES.map((type) => (
          <Checkbox
            key={type}
            checked={value.includes(type)}
            onCheckedChange={() => onChange(toggleServiceType(value, type))}
            label={promoServiceTypeLabels()[type]}
          />
        ))}
      </div>
      <p className="text-xs text-muted">
        {coversAllServices(value)
          ? pm.noneSelected
          : pm.onlySelected}
      </p>
    </fieldset>
  );
}

/** Jadval katakchasi: "Hammasi" yoki xizmat badge'lari. */
export function ServiceTypesCell({ value }: { value: readonly unknown[] | null | undefined }) {
  if (coversAllServices(value)) return <span className="text-muted">{t().common.all}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {PROMO_SERVICE_TYPES.filter((type) => (value ?? []).includes(type)).map((type) => (
        <Badge key={type} variant="neutral" size="sm">
          {promoServiceTypeLabels()[type]}
        </Badge>
      ))}
    </span>
  );
}
