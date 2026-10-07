'use client';

import { MessageSquareText } from 'lucide-react';
import { clsx } from 'clsx';
import type { MarketOrder } from '@/lib/api';
import { ADVANCE_LABEL, DELIVERY_MODE_LABEL, orderCustomerName } from '@/lib/order-status';
import { formatRelative, money } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { vendorCashView } from '@/lib/vendor-cash';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/** Ustunlar: birinchi ustun — odam o'qiy oladigan identifikator (mijoz). */
export const ORDER_ROW_GRID =
  'grid grid-cols-[36px_minmax(0,1fr)_120px_150px_180px] gap-3 items-center';

export function OrderRow({
  order: o,
  checked,
  onCheck,
  onOpen,
  onAdvance,
  advancing,
}: {
  order: MarketOrder;
  checked: boolean;
  onCheck: () => void;
  onOpen: () => void;
  onAdvance: () => void;
  advancing: boolean;
}) {
  const isNew = o.status === 'new';
  const advanceLabel = ADVANCE_LABEL[o.status];
  return (
    <li
      className={clsx(
        ORDER_ROW_GRID,
        'relative px-4 py-3 transition-colors duration-fast',
        // Yangi buyurtma ko'rinmay qolmasligi kerak: to'ldirish + chap
        // chekka chizig'i + "Yangi" badge — uch signal birga.
        isNew ? 'bg-mint-tint/60 hover:bg-mint-tint' : 'hover:bg-surface-2/50'
      )}
    >
      {isNew && <span aria-hidden className="absolute bottom-0 left-0 top-0 w-[3px] bg-primary" />}
      <input
        type="checkbox"
        checked={checked}
        onChange={onCheck}
        aria-label={`${o.id.slice(0, 6)} buyurtmasini tanlash`}
        className="h-4 w-4 accent-brand"
      />
      <button type="button" onClick={onOpen} className="min-w-0 text-left">
        <span className="flex items-center gap-2">
          {isNew && (
            <span aria-hidden className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-mint-deep/60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-deep" />
            </span>
          )}
          <span className="truncate text-body font-semibold text-ink hover:underline">
            {orderCustomerName(o)}
          </span>
          {o.note && (
            <MessageSquareText
              size={13}
              aria-label="Mijoz izohi bor"
              className="shrink-0 text-info-deep dark:text-info-light"
            />
          )}
        </span>
        <span className="mt-0.5 block truncate font-mono text-caption tabular-nums text-muted">
          #{o.id.slice(0, 6)} · {formatRelative(o.createdAt)} ·{' '}
          {o.items.reduce((s, i) => s + i.qty, 0)} ta · {DELIVERY_MODE_LABEL[o.deliveryMode]}
        </span>
      </button>
      <span className="text-right font-mono text-body tabular-nums font-bold text-ink">
        {money(o.totalPrice)}
      </span>
      <span className="flex flex-wrap items-center gap-1">
        <StatusBadge status={o.status} size="sm" />
        <CashBadge order={o} />
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
          <span className="text-caption text-subtle">—</span>
        )}
      </span>
    </li>
  );
}

export function OrderCardMobile({ order: o, onOpen }: { order: MarketOrder; onOpen: () => void }) {
  const isNew = o.status === 'new';
  return (
    <Card padding="none" className={clsx('overflow-hidden', isNew && 'border-mint/50')}>
      <button
        type="button"
        onClick={onOpen}
        className={clsx(
          'w-full p-3 text-left transition-colors duration-fast',
          isNew ? 'bg-mint-tint/60 hover:bg-mint-tint' : 'hover:bg-surface-2/60'
        )}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-body font-semibold text-ink">
              {orderCustomerName(o)}
            </span>
            <span className="mt-0.5 block font-mono text-caption tabular-nums text-muted">
              #{o.id.slice(0, 6)} · {formatRelative(o.createdAt)}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-1">
            <StatusBadge status={o.status} size="sm" />
            <CashBadge order={o} />
          </span>
        </span>
        <span className="mt-2.5 flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-caption text-muted">
            {o.items.reduce((s, i) => s + i.qty, 0)} ta mahsulot
            <Badge variant="default" size="sm">
              {DELIVERY_MODE_LABEL[o.deliveryMode]}
            </Badge>
          </span>
          <span className="shrink-0 font-mono text-body tabular-nums font-bold text-ink">
            {money(o.totalPrice)}
          </span>
        </span>
      </button>
    </Card>
  );
}

/** Kuryer "to'ladim" dedi — sotuvchi tasdig'i kerak; nizo — qizil. */
function CashBadge({ order }: { order: MarketOrder }) {
  const { step } = vendorCashView(order);
  if (step === 'awaiting_vendor') {
    return (
      <Badge variant="warning" size="sm">
        Naqd: tasdiqlang
      </Badge>
    );
  }
  if (step === 'disputed') {
    return (
      <Badge variant="danger" size="sm">
        Naqd nizo
      </Badge>
    );
  }
  return null;
}
