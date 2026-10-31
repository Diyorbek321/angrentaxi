import { Phone, Truck } from 'lucide-react';
import type { FoodOrder } from '@/lib/api';
import { courierState, type CourierTone } from '@/lib/courier';
import { formatPhone } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/Button';
import { t } from '@/locales';

const toneClasses: Record<CourierTone, string> = {
  waiting: 'border-info/30 bg-info-tint text-info-dark dark:text-info-light',
  active: 'border-line bg-surface-2 text-ink',
  done: 'border-line bg-surface-2 text-muted',
  failed: 'border-danger/30 bg-danger-tint text-danger-dark dark:text-danger-light',
};

/**
 * Tayyor buyurtmaning kuryeri. "Kuryer topilmadi" — issiq ovqat kutib
 * turibdi — shuning uchun qizil va tugma bilan: oshxona shu yerdan qayta
 * chaqiradi.
 */
export function CourierStrip({
  order,
  large,
  busy,
  onRedispatch,
}: {
  order: FoodOrder;
  large: boolean;
  busy: boolean;
  onRedispatch: () => void;
}) {
  const state = courierState(order.delivery);
  const driver = order.delivery?.driverName;
  const driverPhone = order.delivery?.driverPhone;

  return (
    <div role="status" className={cn('mt-3 rounded-ds-sm border px-3 py-2.5', toneClasses[state.tone])}>
      <p className={cn('flex items-center gap-1.5 font-semibold', large ? 'text-body-lg' : 'text-[13px]')}>
        <Truck size={14} aria-hidden />
        {state.label}
      </p>
      {state.tone === 'active' && (driver || driverPhone) && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-ink">
          {driver && <span>{driver}</span>}
          {driverPhone && (
            <a
              href={`tel:${driverPhone}`}
              className="num inline-flex min-h-touch items-center gap-1 text-primary-text hover:underline underline-offset-4"
            >
              <Phone size={12} aria-hidden />
              {formatPhone(driverPhone)}
            </a>
          )}
        </p>
      )}
      {state.canRedispatch && (
        <Button
          size="kitchen"
          variant="secondary"
          className={cn('mt-2 w-full', large && 'min-h-[56px] text-h3')}
          isLoading={busy}
          onClick={onRedispatch}
        >
          {t().courier.redispatch}
        </Button>
      )}
    </div>
  );
}
