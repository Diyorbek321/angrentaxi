'use client';

import { AlertTriangle, Banknote, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MoneyText } from '@/components/ui/MoneyText';
import { cn } from '@/components/ui/cn';
import { VendorCashFields, vendorCashView } from '@/lib/vendor-cash';

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
}: {
  order: VendorCashFields;
  busy: boolean;
  onDecide: (received: boolean) => void;
  large?: boolean;
}) {
  const { step, amount, resolution } = vendorCashView(order);
  if (step === 'none') return null;

  if (step === 'awaiting_courier') {
    return (
      <p className={cn('mt-3 flex items-center gap-1.5 text-muted', large ? 'text-sm' : 'text-[13px]')}>
        <Banknote size={14} aria-hidden />
        Kuryer tovar uchun <MoneyText value={amount} className="text-ink" /> naqd toʻlaydi — oling
      </p>
    );
  }

  if (step === 'confirmed') {
    return (
      <p className={cn('mt-3 flex items-center gap-1.5 text-primary-text', large ? 'text-sm' : 'text-[13px]')}>
        <CheckCircle2 size={14} aria-hidden />
        Kuryerdan <MoneyText value={amount} /> olindi
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
          Nizo hal qilindi{resolution ? <span className="text-muted"> — {resolution}</span> : null}
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
        Pul olinmadi — dispetcherga yuborildi, siz bilan bogʻlanadi
      </p>
    );
  }

  // awaiting_vendor: kuryer "to'ladim" dedi — tasdiq kerak.
  return (
    <div role="status" className="mt-3 rounded-ds-sm border border-info/30 bg-info-tint p-3">
      <p className={cn('flex items-center gap-1.5 font-medium text-ink', large ? 'text-base' : 'text-sm')}>
        <Banknote size={15} aria-hidden />
        Kuryer <MoneyText value={amount} /> toʻladim dedi. Oldingizmi?
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" className="flex-1" isLoading={busy} onClick={() => onDecide(true)}>
          Ha, oldim
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => onDecide(false)}>
          Olmadim
        </Button>
      </div>
    </div>
  );
}
