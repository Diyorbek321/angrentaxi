'use client';

import { AlertTriangle, Banknote, CheckCircle2, Undo2, Wallet } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/Button';
import { MoneyText } from '@/components/ui/MoneyText';
import { formatDateTime } from '@/lib/format';
import { VendorCashFields, vendorCashView, type VendorSettlementContext } from '@/lib/vendor-cash';

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
  const text = large ? 'text-body-lg' : 'text-[13px]';

  // Hamyon rejimi: sotuvchidan naqd tasdig'i so'ralmaydi (backend 400 qaytaradi).
  if (step === 'wallet_pending') {
    return (
      <p className={cn('mt-3 flex flex-wrap items-center gap-1.5 text-muted', text)}>
        <Wallet size={14} aria-hidden />
        Olib ketishda kuryer hamyonidan <MoneyText value={amount} className="text-ink" /> oʻtkaziladi — naqd olmang
      </p>
    );
  }

  if (step === 'wallet_settled') {
    return (
      <div role="status" className={cn('mt-3 rounded-ds-sm border border-line bg-surface-2 p-3', text)}>
        <p className="flex items-center gap-1.5 font-medium text-primary-text">
          <Wallet size={14} aria-hidden />
          {reversalCount ? 'Yangi kuryer hamyonidan qayta toʻlandi' : 'Kuryer hamyonidan toʻlandi'}
        </p>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt className="text-muted">Tovar summasi</dt>
          <dd className="text-right">
            <MoneyText value={amount} />
          </dd>
          {commission != null && net != null && (
            <>
              <dt className="text-muted">Komissiya</dt>
              <dd className="text-right">
                <MoneyText value={-commission} />
              </dd>
              <dt className="font-medium text-ink">Sof tushum</dt>
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
      <div role="status" className={cn('mt-3 rounded-ds-sm border border-line bg-surface-2 p-3', text)}>
        <p className="flex flex-wrap items-center gap-1.5 font-medium text-ink">
          <Undo2 size={14} aria-hidden />
          Qaytarildi — <MoneyText value={amount} /> kuryer hamyoniga qaytdi
        </p>
        <p className="mt-1 text-muted">
          {step === 'wallet_resettle_pending'
            ? 'Yangi kuryer biriktirildi — olib ketishda summa qayta oʻtkaziladi.'
            : 'Hozircha sizga hisoblanmagan. Yangi kuryer olib ketganda qayta oʻtkaziladi.'}
          {reversedAt && <span className="num"> · {formatDateTime(reversedAt)}</span>}
        </p>
      </div>
    );
  }

  if (step === 'awaiting_courier') {
    return (
      <p className={cn('mt-3 flex flex-wrap items-center gap-1.5 text-muted', text)}>
        <Banknote size={14} aria-hidden />
        Kuryer tovar uchun <MoneyText value={amount} className="font-semibold text-ink" /> naqd toʻlaydi — oling
      </p>
    );
  }

  if (step === 'confirmed') {
    return (
      <p className={cn('mt-3 flex flex-wrap items-center gap-1.5 text-primary-text', text)}>
        <CheckCircle2 size={14} aria-hidden />
        Kuryerdan <MoneyText value={amount} /> olindi
      </p>
    );
  }

  if (step === 'resolved') {
    return (
      <p role="status" className={cn('mt-3 flex items-start gap-1.5 text-primary-text', text)}>
        <CheckCircle2 size={14} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          Nizo hal qilindi{resolution ? <span className="text-muted"> — {resolution}</span> : null}
        </span>
      </p>
    );
  }

  if (step === 'disputed') {
    return (
      <p
        role="status"
        className={cn(
          'mt-3 flex items-center gap-1.5 rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2 text-danger-dark dark:text-danger-light',
          text
        )}
      >
        <AlertTriangle size={14} aria-hidden />
        Pul olinmadi — dispetcherga yuborildi, siz bilan bogʻlanadi
      </p>
    );
  }

  // awaiting_vendor: kuryer "to'ladim" dedi — tasdiq kerak (sotuvchining qo'lda qarori).
  return (
    <div role="status" className="mt-3 rounded-ds-sm border border-override/40 bg-override-tint p-3">
      <p className={cn('flex flex-wrap items-center gap-1.5 font-semibold text-ink', large ? 'text-body-lg' : 'text-body')}>
        <Banknote size={15} aria-hidden />
        Kuryer <MoneyText value={amount} /> toʻladim dedi. Oldingizmi?
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="kitchen" className="flex-1" isLoading={busy} onClick={() => onDecide(true)}>
          Ha, oldim
        </Button>
        <Button size="kitchen" variant="danger-ghost" disabled={busy} onClick={() => onDecide(false)}>
          Olmadim
        </Button>
      </div>
    </div>
  );
}
