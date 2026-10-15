'use client';

import { MessageSquareText } from 'lucide-react';
import type { MarketOrder } from '@/lib/api';
import { advanceLabelFor, DELIVERY_MODE_LABEL, orderCustomerName } from '@/lib/order-status';
import { formatNumber, formatRelative, shortId } from '@/lib/format';
import { vendorCashView, type VendorSettlementMode } from '@/lib/vendor-cash';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { MoneyText } from '@/components/ui/MoneyText';
import { cn } from '@/components/ui/cn';

/** Ustunlar: tanlash · mijoz/buyurtma · summa · holat · amal. Sarlavha qatori ham shu grid'dan. */
export const ORDER_ROW_GRID =
  'grid grid-cols-[28px_minmax(0,1fr)_120px_190px_190px] gap-3 items-center';

function itemsCount(o: MarketOrder): number {
  return o.items.reduce((s, i) => s + i.qty, 0);
}

export function OrderRow({
  order: o,
  checked,
  onCheck,
  onOpen,
  onAdvance,
  advancing,
  settlementMode,
}: {
  order: MarketOrder;
  checked: boolean;
  onCheck: () => void;
  onOpen: () => void;
  onAdvance: () => void;
  advancing: boolean;
  /** Hamyon rejimida naqd tasdig'i badge'i chiqmaydi. */
  settlementMode?: VendorSettlementMode;
}) {
  const isNew = o.status === 'new';
  const advanceLabel = advanceLabelFor(o);
  return (
    <li
      className={cn(
        ORDER_ROW_GRID,
        'relative min-h-[52px] px-4 py-2 transition-colors',
        // Yangi buyurtma ko'rinmay qolmasligi kerak: chap chiziq + "Yangi"
        // badge + asosiy tugma — uch signal birga, lekin sokin.
        isNew ? 'bg-mint-tint/40 hover:bg-mint-tint/70' : 'hover:bg-surface-2/60'
      )}
    >
      {isNew && <span aria-hidden className="absolute bottom-0 left-0 top-0 w-0.5 bg-primary dark:bg-mint" />}
      <Checkbox checked={checked} onCheckedChange={onCheck} aria-label={`${shortId(o.id)} buyurtmasini tanlash`} />
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 rounded-ds-xs text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-ink hover:underline">{orderCustomerName(o)}</span>
          {o.note && (
            <MessageSquareText size={13} aria-label="Mijoz izohi bor" className="shrink-0 text-info-dark dark:text-info-light" />
          )}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <span className="shrink-0 font-mono text-ink">{shortId(o.id)}</span>
          <span aria-hidden>·</span>
          <span className="truncate">
            {formatRelative(o.createdAt)} · <span className="num">{formatNumber(itemsCount(o))}</span> ta ·{' '}
            {DELIVERY_MODE_LABEL[o.deliveryMode]}
          </span>
        </span>
      </button>
      <MoneyText value={o.totalPrice} className="text-right text-[13px] font-medium text-ink" />
      <span className="flex flex-wrap items-center gap-1">
        <StatusBadge status={o.status} />
        <CashBadge order={o} mode={settlementMode} />
      </span>
      <span>
        {advanceLabel ? (
          <Button
            size="sm"
            variant={isNew ? 'primary' : 'secondary'}
            isLoading={advancing}
            onClick={onAdvance}
            className="w-full"
          >
            {advanceLabel}
          </Button>
        ) : (
          <span className="text-xs text-subtle">—</span>
        )}
      </span>
    </li>
  );
}

/** Mobil (lg dan past): xuddi shu ma'lumot ixcham kartada. */
export function OrderCardMobile({
  order: o,
  onOpen,
  settlementMode,
}: {
  order: MarketOrder;
  onOpen: () => void;
  settlementMode?: VendorSettlementMode;
}) {
  const isNew = o.status === 'new';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'relative w-full overflow-hidden rounded-ds-md border bg-surface p-3 text-left transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        isNew ? 'border-mint/40 bg-mint-tint/40' : 'border-line hover:bg-surface-2/60'
      )}
    >
      {isNew && <span aria-hidden className="absolute bottom-0 left-0 top-0 w-0.5 bg-primary dark:bg-mint" />}
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-ink">{orderCustomerName(o)}</span>
          <span className="mt-0.5 block text-xs text-muted">
            <span className="font-mono text-ink">{shortId(o.id)}</span> · {formatRelative(o.createdAt)}
          </span>
        </span>
        <span className="flex flex-wrap items-center justify-end gap-1">
          <StatusBadge status={o.status} />
          <CashBadge order={o} mode={settlementMode} />
        </span>
      </span>
      <span className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="truncate">
          <span className="num">{formatNumber(itemsCount(o))}</span> ta mahsulot · {DELIVERY_MODE_LABEL[o.deliveryMode]}
        </span>
        <MoneyText value={o.totalPrice} className="shrink-0 text-[13px] font-medium text-ink" />
      </span>
    </button>
  );
}

/** Kuryer "to'ladim" dedi — sotuvchi tasdig'i kerak; nizo — qizil; hamyon teskarisi — neytral. */
function CashBadge({ order, mode }: { order: MarketOrder; mode?: VendorSettlementMode }) {
  const { step } = vendorCashView(order, { mode });
  if (step === 'awaiting_vendor') return <Badge variant="info">Naqd: tasdiqlang</Badge>;
  if (step === 'disputed') return <Badge variant="danger">Naqd nizo</Badge>;
  // Hamyon o'tkazmasi teskari qilindi (§22 `vendorWalletSettlement.reversedAt`).
  if (step === 'wallet_reversed') return <Badge variant="neutral">Qaytarildi</Badge>;
  if (step === 'wallet_resettle_pending') return <Badge variant="info">Qayta oʻtkaziladi</Badge>;
  return null;
}
