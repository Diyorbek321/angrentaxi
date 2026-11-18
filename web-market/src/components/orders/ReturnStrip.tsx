import { Banknote, Phone, Undo2 } from 'lucide-react';
import type { MarketOrder } from '@/lib/api';
import { returnCashToCourier, type VendorSettlementContext } from '@/lib/vendor-cash';
import { formatMoney, formatPhone } from '@/lib/format';
import { t } from '@/locales';

/**
 * Kuryer yetkaza olmadi (INCIDENT-POLICY §2): tovar do'konga qaytarilmoqda —
 * sabab, kuryer telefoni va (naqd to'lagan bo'lsa) kuryerga qaytariladigan
 * pul. "Qaytib keldi" tugmasi oynaning pastki qatorida. Boshqa holatda — hech narsa.
 */
export function ReturnStrip({ order, settlement }: { order: MarketOrder; settlement?: VendorSettlementContext }) {
  if (order.status !== 'returning') return null;
  const m = t().returns;
  const reason = order.delivery?.deliveryFailureReason;
  const cash = returnCashToCourier(order, settlement);

  return (
    <div role="status" className="rounded-ds-sm border border-danger/30 bg-danger-tint p-3 text-[13px]">
      <p className="flex items-center gap-1.5 font-semibold text-danger-dark dark:text-danger-light">
        <Undo2 size={14} aria-hidden />
        {m.returningTitle}
      </p>
      {reason && <p className="mt-0.5 text-ink">{m.reasons[reason]}</p>}
      {order.delivery?.driverPhone && (
        <a
          href={`tel:${order.delivery.driverPhone}`}
          className="num mt-1 inline-flex items-center gap-1 text-primary-text hover:underline underline-offset-4"
        >
          <Phone size={12} aria-hidden />
          {order.delivery.driverName || m.courier} · {formatPhone(order.delivery.driverPhone)}
        </a>
      )}
      {cash > 0 && (
        <p className="mt-1 flex items-center gap-1.5 font-medium text-ink">
          <Banknote size={14} aria-hidden />
          {m.cashBack(formatMoney(cash))}
        </p>
      )}
    </div>
  );
}
