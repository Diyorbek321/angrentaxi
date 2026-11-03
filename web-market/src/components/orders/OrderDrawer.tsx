'use client';

import { useState } from 'react';
import { Check, MapPin, MessageSquareText, Phone, Truck } from 'lucide-react';
import { marketApi, MarketOrder } from '@/lib/api';
import {
  advanceLabelFor,
  canConfirmReturned,
  deliveryModeLabel,
  terminalLabel,
  orderCustomerName,
  orderCustomerPhone,
} from '@/lib/order-status';
import { errorMessage } from '@/lib/utils';
import { formatPhone, formatRelative, formatTime, shortId } from '@/lib/format';
import { courierState, CourierTone } from '@/lib/courier';
import { StatusBadge } from '@/components/StatusBadge';
import { VendorCashStrip } from '@/components/VendorCashStrip';
import { returnCashToCourier, type VendorSettlementContext } from '@/lib/vendor-cash';
import { formatMoney } from '@/lib/format';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { ReturnStrip } from './ReturnStrip';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { MoneyText } from '@/components/ui/MoneyText';
import { KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { cn } from '@/components/ui/cn';
import { AddressDetailsBlock, CustomerCancelNotice, DiscountLines, PaymentPendingNotice } from './OrderExtras';
import { isPaymentPending } from '@/lib/order-extras';
import { t } from '@/locales';

export interface OrderDrawerProps {
  order: MarketOrder | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
  /** Hisob-kitob rejimi + do'kon komissiyasi (lib/vendor-cash.ts). */
  settlement?: VendorSettlementContext;
}

/**
 * Buyurtma detali — sotuvchining hamma savoliga bitta ekranda javob:
 * nima, nechta, kimga, qayerga, kim yetkazadi, mijoz nima dedi.
 * Holat faqat BITTA oldinga tugma bilan o'zgaradi (zinapoya, sakrash yo'q).
 */
export function OrderDrawer({ order, onClose, onChanged, onError, settlement }: OrderDrawerProps) {
  const [busy, setBusy] = useState(false);
  const [togglingIndex, setTogglingIndex] = useState<number | null>(null);
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const { toast } = useToast();

  if (!order) return null;

  const m = t();
  const packedCount = order.items.filter((i) => i.packed).length;
  const advanceLabel = advanceLabelFor(order);
  const phone = orderCustomerPhone(order);
  // Kartali buyurtma toʻlovdan oldin yigʻishga olinmaydi (INCIDENT-POLICY §1).
  const paymentPending = isPaymentPending(order);

  const togglePack = async (index: number) => {
    setTogglingIndex(index);
    try {
      await marketApi.togglePackItem(order.id, index);
      await onChanged();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setTogglingIndex(null);
    }
  };

  const redispatch = async () => {
    setBusy(true);
    try {
      await marketApi.redispatchOrder(order.id);
      await onChanged();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const decideCash = async (received: boolean) => {
    setBusy(true);
    try {
      await marketApi.cashReceived(order.id, received);
      await onChanged();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Kuryer qaytargan tovar do'konga yetdi — buyurtma "Qaytarildi" bo'ladi.
  const confirmReturned = async () => {
    setBusy(true);
    try {
      await marketApi.confirmReturned(order.id);
      setConfirmingReturn(false);
      await onChanged();
      toast({ title: m.returns.confirmed, variant: 'success' });
    } catch (err) {
      setConfirmingReturn(false);
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const returnCash = returnCashToCourier(order, settlement);

  const advance = async () => {
    setBusy(true);
    try {
      await marketApi.advanceOrder(order.id);
      await onChanged();
      onClose();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={m.orders.drawerTitle(shortId(order.id))}
      subtitle={`${orderCustomerName(order)} · ${formatRelative(order.createdAt)} (${formatTime(order.createdAt)})`}
      footer={
        <div className="space-y-3">
          <DiscountLines order={order} />
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted">{m.orders.total}</span>
            <MoneyText value={order.totalPrice} className="text-base font-semibold text-ink" />
          </div>
          {canConfirmReturned(order) ? (
            <Button className="w-full" size="lg" isLoading={busy} onClick={() => setConfirmingReturn(true)}>
              {m.returns.confirm}
            </Button>
          ) : advanceLabel ? (
            <Button className="w-full" size="lg" isLoading={busy} disabled={paymentPending} onClick={() => void advance()}>
              {paymentPending ? m.cardPayment.pending : advanceLabel}
            </Button>
          ) : (
            <p className="py-2 text-center text-sm font-medium text-muted">
              {terminalLabel(order.status) ?? m.orders.autoComplete}
            </p>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          {/* Yetkazish rejimi — haqiqiy sozlama (`deliveryMode`): kim
              yetkazishini karta o'zi aytadi, taxmin qoldirmaydi. */}
          <Badge variant="neutral" icon={<Truck aria-hidden />}>
            {deliveryModeLabel(order.deliveryMode)}
          </Badge>
        </div>
        <span className="num text-[13px] font-medium text-muted">
          {m.orders.packed(packedCount, order.items.length)}
        </span>
      </div>

      {order.status === 'shipped' && order.deliveryMode === 'platform' && (
        <CourierStrip order={order} busy={busy} onRedispatch={() => void redispatch()} />
      )}

      <CustomerCancelNotice order={order} />
      <PaymentPendingNotice order={order} className="mt-3" />
      <ReturnStrip order={order} settlement={settlement} />

      {/* Naqd + platforma kuryeri: kuryer tovar pulini do'konga to'laydi. */}
      {order.deliveryMode === 'platform' &&
        (order.status === 'shipped' || order.status === 'delivered') && (
          <VendorCashStrip
            order={order}
            busy={busy}
            onDecide={(r) => void decideCash(r)}
            settlement={settlement}
          />
        )}

      {/* Mijoz izohi — xatolarning 1-manbai, shuning uchun ro'yxatdan OLDIN
          va ko'zga tashlanadigan blokda. */}
      {order.note && (
        <div className="rounded-ds-sm border border-info/30 bg-info-tint p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-info-dark dark:text-info-light">
            <MessageSquareText size={12} aria-hidden />
            {m.orders.customerNote}
          </p>
          <p className="mt-1 text-sm font-medium text-ink">{order.note}</p>
        </div>
      )}

      {(phone || order.deliveryAddress) && (
        <KeyValueList className="rounded-ds-sm border border-line px-3 py-2.5">
          {phone && (
            <KeyValue label={m.orders.customerPhone}>
              <a href={`tel:${phone}`} className="num inline-flex items-center gap-1.5 font-medium text-primary-text hover:underline">
                <Phone size={13} aria-hidden />
                {formatPhone(phone)}
              </a>
            </KeyValue>
          )}
          {order.deliveryAddress && (
            <KeyValue label={m.orders.deliveryAddress}>
              <span className="inline-flex items-start gap-1.5">
                <MapPin size={13} aria-hidden className="mt-0.5 shrink-0 text-subtle" />
                {order.deliveryAddress}
              </span>
            </KeyValue>
          )}
        </KeyValueList>
      )}

      <AddressDetailsBlock details={order.addressDetails} />

      <div>
        <p className="mb-2 text-[13px] font-medium text-muted">
          {m.orders.packList(order.items.length)}
        </p>
        <ul className="space-y-1">
          {order.items.map((it, index) => (
            <li key={`${it.productId}-${index}`}>
              <button
                type="button"
                onClick={() => void togglePack(index)}
                aria-pressed={it.packed}
                disabled={togglingIndex !== null}
                className="flex w-full items-center gap-3 rounded-ds-sm px-2.5 py-2 text-left transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border',
                    it.packed ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface'
                  )}
                >
                  {it.packed && <Check size={13} strokeWidth={3.2} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-[13px] font-medium',
                      it.packed ? 'text-muted line-through' : 'text-ink'
                    )}
                  >
                    {it.name}
                  </span>
                  <span className="num mt-0.5 block text-xs text-subtle">
                    <MoneyText value={it.price} /> × {it.qty}
                  </span>
                </span>
                <MoneyText value={it.price * it.qty} className="shrink-0 text-[13px] font-medium text-ink" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <ConfirmDialog
        isOpen={confirmingReturn}
        onClose={() => setConfirmingReturn(false)}
        onConfirm={confirmReturned}
        title={m.returns.confirmTitle}
        description={
          returnCash > 0 ? (
            <>
              {m.returns.confirmBody} <strong>{m.returns.confirmCash(formatMoney(returnCash))}</strong>
            </>
          ) : (
            m.returns.confirmBody
          )
        }
        confirmLabel={m.returns.confirm}
        isPending={busy}
      />
    </Drawer>
  );
}

const courierToneClasses: Record<CourierTone, string> = {
  waiting: 'border-info/30 bg-info-tint text-info-dark dark:text-info-light',
  active: 'border-mint/30 bg-mint-tint text-primary-text',
  done: 'border-line bg-surface-2 text-muted',
  failed: 'border-danger/30 bg-danger-tint text-danger-dark dark:text-danger-light',
};

/**
 * Platforma kuryeri. "Kuryer topilmadi" qizil va tugma bilan: sotuvchi
 * boshqa oynani qidirmasdan shu yerdan qayta chaqiradi.
 */
function CourierStrip({
  order,
  busy,
  onRedispatch,
}: {
  order: MarketOrder;
  busy: boolean;
  onRedispatch: () => void;
}) {
  const state = courierState(order.delivery);
  const driver = order.delivery?.driverName;
  const driverPhone = order.delivery?.driverPhone;

  return (
    <div role="status" className={cn('rounded-ds-sm border p-3', courierToneClasses[state.tone])}>
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Truck size={14} aria-hidden />
        {state.label}
      </p>
      {state.tone === 'active' && (driver || driverPhone) && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-ink">
          {driver && <span>{driver}</span>}
          {driverPhone && (
            <a href={`tel:${driverPhone}`} className="num inline-flex items-center gap-1 hover:underline">
              <Phone size={12} aria-hidden />
              {formatPhone(driverPhone)}
            </a>
          )}
        </p>
      )}
      {state.canRedispatch && (
        <Button variant="secondary" size="sm" className="mt-2 w-full" isLoading={busy} onClick={onRedispatch}>
          {t().courier.redispatch}
        </Button>
      )}
    </div>
  );
}
