'use client';

import { AlertTriangle, Banknote, CheckCircle2, Undo2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MoneyText } from '@/components/ui/MoneyText';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { VendorCashFields, vendorCashView, type VendorSettlementContext } from '@/lib/vendor-cash';
import { t } from '@/locales';

/**
 * Naqd buyurtma: kuryer tovar pulini do'konga to'laydi. Sotuvchi "oldim" yoki
 * "olmadim" deydi — ikkinchisi dispetcherga nizo bo'lib ketadi.
 *
 * Karta buyurtmasida hech narsa chizilmaydi.
 */
export function VendorCashStrip({
  order,
  busy,
  onDecide,
  large = false,
  settlement,
}: {
  order: VendorCashFields;
  busy: boolean;
  onDecide: (received: boolean) => void;
  large?: boolean;
  /** Hisob-kitob rejimi (`GET /settings/public`). Summalar buyurtmaning o'zidan (`vendorWalletSettlement`). */
  settlement?: VendorSettlementContext;
}) {
  const { step, amount, resolution, commission, net, reversedAt, reversalCount } = vendorCashView(order, settlement);
  if (step === 'none') return null;
  const m = t().vendorCash;

  // Hamyon rejimi: sotuvchidan naqd tasdig'i so'ralmaydi (backend 400 qaytaradi).
  if (step === 'wallet_pending') {
    return (
      <p className={cn('mt-3 flex flex-wrap items-center gap-1.5 text-muted', large ? 'text-sm' : 'text-[13px]')}>
        <Wallet size={14} aria-hidden />
        {m.walletPending.before}
        <MoneyText value={amount} className="text-ink" />
        {m.walletPending.after}
      </p>
    );
  }

  if (step === 'wallet_settled') {
    return (
      <div role="status" className={cn('mt-3 rounded-ds-sm border border-line bg-surface-2 p-3', large ? 'text-sm' : 'text-[13px]')}>
        <p className="flex items-center gap-1.5 font-medium text-primary-text">
          <Wallet size={14} aria-hidden />
          {reversalCount ? m.resettled : m.settled}
        </p>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt className="text-muted">{m.goodsAmount}</dt>
          <dd className="text-right">
            <MoneyText value={amount} />
          </dd>
          {commission != null && net != null && (
            <>
              <dt className="text-muted">{m.commission}</dt>
              <dd className="text-right">
                <MoneyText value={-commission} />
              </dd>
              <dt className="font-medium text-ink">{m.net}</dt>
              <dd className="text-right font-medium text-ink">
                <MoneyText value={net} />
              </dd>
            </>
          )}
        </dl>
      </div>
    );
  }

  // O'tkazma teskari qilindi: yetkazish bekor yoki kuryer almashtirildi (§14, §19).
  if (step === 'wallet_reversed' || step === 'wallet_resettle_pending') {
    return (
      <div role="status" className={cn('mt-3 rounded-ds-sm border border-line bg-surface-2 p-3', large ? 'text-sm' : 'text-[13px]')}>
        <p className="flex flex-wrap items-center gap-1.5 font-medium text-ink">
          <Undo2 size={14} aria-hidden />
          {m.reversed.before}
          <MoneyText value={amount} />
          {m.reversed.after}
        </p>
        <p className="mt-1 text-muted">
          {step === 'wallet_resettle_pending'
            ? m.resettlePending
            : m.notCredited}
          {reversedAt && <span className="num"> · {formatDateTime(reversedAt)}</span>}
        </p>
      </div>
    );
  }

  if (step === 'awaiting_courier') {
    return (
      <p className={cn('mt-3 flex items-center gap-1.5 text-muted', large ? 'text-sm' : 'text-[13px]')}>
        <Banknote size={14} aria-hidden />
        {m.awaitingCourier.before}
        <MoneyText value={amount} className="text-ink" />
        {m.awaitingCourier.after}
      </p>
    );
  }

  if (step === 'confirmed') {
    return (
      <p className={cn('mt-3 flex items-center gap-1.5 text-primary-text', large ? 'text-sm' : 'text-[13px]')}>
        <CheckCircle2 size={14} aria-hidden />
        {m.confirmed.before}
        <MoneyText value={amount} />
        {m.confirmed.after}
      </p>
    );
  }

  if (step === 'resolved') {
    return (
      <p
        role="status"
        className={cn('mt-3 flex items-start gap-1.5 text-primary-text', large ? 'text-sm' : 'text-[13px]')}
      >
        <CheckCircle2 size={14} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          {m.resolved}{resolution ? <span className="text-muted"> — {resolution}</span> : null}
        </span>
      </p>
    );
  }

  if (step === 'disputed') {
    return (
      <p
        role="status"
        className="mt-3 flex items-center gap-1.5 rounded-ds-sm border border-danger/30 bg-danger-tint p-2 text-[13px] text-danger-dark dark:text-danger-light"
      >
        <AlertTriangle size={14} aria-hidden />
        {m.disputed}
      </p>
    );
  }

  // awaiting_vendor: kuryer "to'ladim" dedi — tasdiq kerak.
  return (
    <div role="status" className="mt-3 rounded-ds-sm border border-info/30 bg-info-tint p-3">
      <p className={cn('flex items-center gap-1.5 font-medium text-ink', large ? 'text-base' : 'text-sm')}>
        <Banknote size={15} aria-hidden />
        {m.awaitingVendor.before}
        <MoneyText value={amount} />
        {m.awaitingVendor.after}
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" className="flex-1" isLoading={busy} onClick={() => onDecide(true)}>
          {m.yes}
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => onDecide(false)}>
          {m.no}
        </Button>
      </div>
    </div>
  );
}
