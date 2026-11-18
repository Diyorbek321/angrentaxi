'use client';

import { Banknote, Phone, Undo2 } from 'lucide-react';
import type { FoodOrder } from '@/lib/api';
import { canConfirmReturned } from '@/lib/order-status';
import { returnCashToCourier, type VendorSettlementContext } from '@/lib/vendor-cash';
import { formatMoney, formatPhone } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/Button';
import { t } from '@/locales';

/**
 * Kuryer yetkaza olmadi (INCIDENT-POLICY §2): tovar do'konga qaytarilmoqda.
 * Sotuvchi tovarni qabul qilgach "Qaytib keldi" ni bosadi; kuryer naqd
 * to'lagan bo'lsa — shu pulni kuryerga qaytarishi shu yerda aytiladi.
 * Boshqa holatlarda hech narsa chizilmaydi.
 */
export function ReturnStrip({
  order,
  busy,
  onConfirm,
  large = false,
  settlement,
}: {
  order: FoodOrder;
  busy: boolean;
  /** Undefined — tugmasiz (masalan, oynada alohida tugma bor). */
  onConfirm?: () => void;
  large?: boolean;
  settlement?: VendorSettlementContext;
}) {
  if (order.status !== 'returning' && order.status !== 'returned') return null;
  const m = t().returns;
  const text = large ? 'text-body-lg' : 'text-[13px]';

  if (order.status === 'returned') {
    return (
      <p role="status" className={cn('mt-3 flex items-center gap-1.5 text-muted', text)}>
        <Undo2 size={14} aria-hidden />
        {m.returnedTitle}
      </p>
    );
  }

  const reason = order.delivery?.deliveryFailureReason;
  const cash = returnCashToCourier(order, settlement);

  return (
    <div role="status" className={cn('mt-3 rounded-ds-sm border border-danger/30 bg-danger-tint p-3', text)}>
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
      {onConfirm && canConfirmReturned(order) && (
        <Button
          size="kitchen"
          className={cn('mt-3 w-full', large && 'min-h-[56px] text-h3')}
          isLoading={busy}
          onClick={onConfirm}
        >
          {m.confirm}
        </Button>
      )}
    </div>
  );
}
