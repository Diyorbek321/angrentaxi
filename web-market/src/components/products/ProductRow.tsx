'use client';

import { CheckCircle2, CircleOff, Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';
import type { Product, ProductStatus } from '@/lib/api';
import { stockTone } from '@/lib/product-status';
import { hueTint, moneyShort } from '@/lib/utils';
import { ProductStatusBadge } from '@/components/StatusBadge';
import { Card } from '@/components/ui/Card';
import { InlineEditCell } from './InlineEditCell';

/** Jadval ustunlari — sahifadagi sarlavha qatori bilan bir xil bo'lishi shart. */
export const PRODUCT_ROW_GRID =
  'grid grid-cols-[36px_minmax(0,2fr)_150px_150px_120px_96px] xl:grid-cols-[36px_minmax(0,1.8fr)_minmax(0,1fr)_150px_150px_120px_96px] gap-3 items-center';

export interface ProductRowProps {
  product: Product;
  categoryName: string;
  threshold: number;
  checked: boolean;
  onCheck: () => void;
  onSavePrice: (value: number) => Promise<void>;
  onSaveStock: (value: number) => Promise<void>;
  onSetStatus: (status: ProductStatus) => void;
  statusBusy: boolean;
}

/**
 * Holatga mos TEZKOR amallar (ko'pi bilan 2 ta ko'rinadigan tugma):
 * sotuvdagi mahsulot bir bosishda "tugadi" bo'ladi yoki yashiriladi,
 * tugagani/yashirilgani bir bosishda sotuvga qaytadi.
 */
function QuickStatusActions({
  status,
  busy,
  onSetStatus,
}: {
  status: ProductStatus;
  busy: boolean;
  onSetStatus: (status: ProductStatus) => void;
}) {
  const btn =
    'flex h-8 w-8 items-center justify-center rounded-ds-xs border border-line text-muted transition-colors duration-fast hover:bg-surface-2 hover:text-ink disabled:opacity-45 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface';
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSetStatus('out')}
          aria-label="Tugadi deb belgilash"
          title="Tugadi deb belgilash"
          className={btn}
        >
          <CircleOff size={14} aria-hidden />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSetStatus('hidden')}
          aria-label="Sotuvdan yashirish"
          title="Sotuvdan yashirish"
          className={btn}
        >
          <EyeOff size={14} aria-hidden />
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onSetStatus('active')}
      aria-label="Sotuvga qaytarish"
      title="Sotuvga qaytarish"
      className={btn}
    >
      {status === 'hidden' ? <Eye size={14} aria-hidden /> : <CheckCircle2 size={14} aria-hidden />}
    </button>
  );
}

export function ProductRow({
  product: p,
  categoryName,
  threshold,
  checked,
  onCheck,
  onSavePrice,
  onSaveStock,
  onSetStatus,
  statusBusy,
}: ProductRowProps) {
  const tone = stockTone(p.stock, threshold);
  return (
    <li className={clsx(PRODUCT_ROW_GRID, 'px-4 py-2.5')}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onCheck}
        aria-label={`${p.name} tanlash`}
        className="h-4 w-4 accent-brand"
      />
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          style={hueTint(p.hue)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-sm text-lg"
        >
          {p.emoji}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-body font-semibold text-ink">{p.name}</span>
          <span className="mt-0.5 block truncate font-mono text-caption text-subtle">
            {p.sku || '—'}
            <span className="xl:hidden"> · {categoryName}</span>
          </span>
        </span>
      </div>
      <span className="hidden truncate text-caption text-muted xl:block">{categoryName}</span>
      <InlineEditCell
        value={p.price}
        display={moneyShort(p.price)}
        unit="so'm"
        ariaLabel={`${p.name} narxi`}
        onSave={onSavePrice}
      />
      <InlineEditCell
        value={p.stock}
        display={String(p.stock)}
        unit={p.unit}
        ariaLabel={`${p.name} zaxirasi — ${tone.label}`}
        valueClassName={tone.text}
        onSave={onSaveStock}
      />
      <span>
        <ProductStatusBadge status={p.status} size="sm" />
      </span>
      <QuickStatusActions status={p.status} busy={statusBusy} onSetStatus={onSetStatus} />
    </li>
  );
}

/** Mobil (lg dan past): xuddi shu maydonlar karta ichida. */
export function ProductCardMobile({
  product: p,
  categoryName,
  threshold,
  checked,
  onCheck,
  onSavePrice,
  onSaveStock,
  onSetStatus,
  statusBusy,
}: ProductRowProps) {
  const tone = stockTone(p.stock, threshold);
  return (
    <Card padding="sm">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          aria-label={`${p.name} tanlash`}
          className="mt-1 h-4 w-4 shrink-0 accent-brand"
        />
        <span
          aria-hidden
          style={hueTint(p.hue)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-sm text-lg"
        >
          {p.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold text-ink">{p.name}</p>
          <p className="mt-0.5 truncate font-mono text-caption text-subtle">
            {p.sku || '—'} · {categoryName}
          </p>
        </div>
        <ProductStatusBadge status={p.status} size="sm" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-caption font-medium text-muted">Narx</p>
          <InlineEditCell
            value={p.price}
            display={moneyShort(p.price)}
            unit="so'm"
            ariaLabel={`${p.name} narxi`}
            onSave={onSavePrice}
          />
        </div>
        <div>
          <p className="mb-1 text-caption font-medium text-muted">Zaxira — {tone.label}</p>
          <InlineEditCell
            value={p.stock}
            display={String(p.stock)}
            unit={p.unit}
            ariaLabel={`${p.name} zaxirasi`}
            valueClassName={tone.text}
            onSave={onSaveStock}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <QuickStatusActions status={p.status} busy={statusBusy} onSetStatus={onSetStatus} />
      </div>
    </Card>
  );
}
