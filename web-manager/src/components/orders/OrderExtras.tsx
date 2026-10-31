import { Building2, CircleSlash, Tag } from 'lucide-react';
import {
  addressDetailLines,
  customerCancelText,
  formatAddressShort,
  isCustomerCancelled,
  orderDiscounts,
  type AddressDetails,
  type OrderV5Fields,
} from '@/lib/order-extras';
import { KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { MoneyText } from '@/components/ui/MoneyText';
import { cn } from '@/components/ui/cn';
import { t } from '@/locales';

/**
 * Buyurtmaning v5 bloklari (docs/specs/food-market-ux-v5.md): manzil
 * tafsilotlari, chegirmalar, mijoz bekor qilgani. Maydon yo'q bo'lsa
 * blok umuman chizilmaydi — backend hali bermagan bo'lishi mumkin.
 */

/** Kartadagi bir qator: "2-podyezd · 5-qavat · 34-xonadon · domofon 34K". */
export function AddressShortLine({ details, className }: { details?: AddressDetails | null; className?: string }) {
  const text = formatAddressShort(details);
  if (!text) return null;
  return (
    <p className={cn('flex items-center gap-1.5 text-[13px] text-muted', className)}>
      <Building2 size={13} className="shrink-0" aria-hidden />
      <span className="truncate">{text}</span>
    </p>
  );
}

/** Drawer: barcha to'ldirilgan maydonlar (podyezd … kuryerga izoh). */
export function AddressDetailsBlock({ details }: { details?: AddressDetails | null }) {
  const lines = addressDetailLines(details);
  if (lines.length === 0) return null;
  const title = t().orders.extras.addressDetails;
  return (
    <section aria-label={title} className="rounded-ds-sm border border-line px-3 py-2.5">
      <h3 className="mb-1.5 text-xs font-semibold text-subtle">{title}</h3>
      <KeyValueList>
        {lines.map((l) => (
          <KeyValue key={l.key} label={l.label}>
            {l.value}
          </KeyValue>
        ))}
      </KeyValueList>
    </section>
  );
}

/**
 * Chegirma qatorlari jami summadan oldin. Aksiya — vendor hisobidan,
 * promokod — platforma hisobidan (vendor ulushi kamaymaydi).
 */
export function DiscountLines({ order, className }: { order: OrderV5Fields; className?: string }) {
  const d = orderDiscounts(order);
  if (!d.hasAny) return null;
  const m = t().orders.extras;
  return (
    <dl className={cn('flex flex-col gap-1 text-[13px]', className)}>
      {d.promotionDiscount > 0 && (
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">{m.promotionDiscount}</dt>
          <dd className="font-medium text-ink">
            −<MoneyText value={d.promotionDiscount} />
          </dd>
        </div>
      )}
      {(d.promoCode || d.promoDiscount > 0) && (
        <div className="flex items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-1.5 text-muted">
            <Tag size={12} aria-hidden />
            {m.promoCode}
            {d.promoCode && <span className="font-mono text-ink">{d.promoCode}</span>}
          </dt>
          <dd className="text-right">
            {d.promoDiscount > 0 ? (
              <span className="font-medium text-ink">
                −<MoneyText value={d.promoDiscount} />
              </span>
            ) : (
              '—'
            )}
            <span className="block text-[11px] text-subtle">{m.platformFunded}</span>
          </dd>
        </div>
      )}
    </dl>
  );
}

/** "Mijoz bekor qildi: sabab" — past urg'uli qizil, jonli ogohlantirishlar yonida baqirmaydi. */
export function CustomerCancelNotice({
  order,
  className,
}: {
  order: { status: string } & OrderV5Fields;
  className?: string;
}) {
  if (!isCustomerCancelled(order)) return null;
  return (
    <p
      role="note"
      className={cn(
        'flex items-start gap-1.5 rounded-ds-sm border border-line bg-surface-2 px-3 py-2 text-[13px] text-danger-dark dark:text-danger-light',
        className
      )}
    >
      <CircleSlash size={13} aria-hidden className="mt-0.5 shrink-0" />
      <span>{customerCancelText(order)}</span>
    </p>
  );
}
