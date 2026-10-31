'use client';

import { CheckCircle2, CircleOff, Eye, EyeOff, ImagePlus, MoreHorizontal } from 'lucide-react';
import type { Product, ProductStatus } from '@/lib/api';
import { stockTone } from '@/lib/product-status';
import { formatNumber } from '@/lib/format';
import { ProductStatusBadge } from '@/components/StatusBadge';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { IconButton } from '@/components/ui/IconButton';
import { DiscountTag } from '@/components/promotions/DiscountTag';
import { InlineEditCell } from './InlineEditCell';
import { ProductThumb } from './ProductThumb';
import { t } from '@/locales';

export interface ProductColumnHandlers {
  categoryName: (id: string | null) => string;
  /** Do'konning haqiqiy `lowStockThreshold` sozlamasi. */
  threshold: number;
  onSavePrice: (p: Product, value: number) => Promise<void>;
  onSaveStock: (p: Product, value: number) => Promise<void>;
  onSetStatus: (p: Product, status: ProductStatus) => void;
  statusBusyId: string | null;
  onEditImage: (p: Product) => void;
}

/**
 * Holatga mos TEZKOR amal (bitta ko'rinadigan ikon-tugma, tooltip bilan) +
 * qolganlari `⋯` menyusida. Sotuvdagi mahsulot bir bosishda yashiriladi,
 * tugagani/yashirilgani bir bosishda sotuvga qaytadi.
 */
function RowActions({ product: p, busy, h }: { product: Product; busy: boolean; h: ProductColumnHandlers }) {
  const m = t().products;
  const set = (status: ProductStatus) => h.onSetStatus(p, status);
  return (
    <span className="flex items-center justify-end gap-0.5">
      {p.status === 'active' ? (
        <IconButton aria-label={m.hideFromSale} size="sm" disabled={busy} onClick={() => set('hidden')}>
          <EyeOff aria-hidden />
        </IconButton>
      ) : (
        <IconButton aria-label={m.returnToSale} size="sm" disabled={busy} onClick={() => set('active')}>
          {p.status === 'hidden' ? <Eye aria-hidden /> : <CheckCircle2 aria-hidden />}
        </IconButton>
      )}
      <DropdownMenu
        align="end"
        minWidth={200}
        items={[
          ...(p.status === 'active'
            ? [{ label: m.markOut, icon: <CircleOff aria-hidden />, disabled: busy, onSelect: () => set('out') }]
            : []),
          ...(p.status !== 'hidden'
            ? [{ label: m.hideFromSale, icon: <EyeOff aria-hidden />, disabled: busy, onSelect: () => set('hidden') }]
            : []),
          ...(p.status !== 'active'
            ? [{ label: m.returnToSale, icon: <Eye aria-hidden />, disabled: busy, onSelect: () => set('active') }]
            : []),
          { type: 'separator' as const },
          { label: m.changeImage, icon: <ImagePlus aria-hidden />, onSelect: () => h.onEditImage(p) },
        ]}
        trigger={(t) => (
          <IconButton {...t} ref={t.ref} size="sm" aria-label={m.moreActions(p.name)}>
            <MoreHorizontal aria-hidden />
          </IconButton>
        )}
      />
    </span>
  );
}

export function productColumns(h: ProductColumnHandlers): DataTableColumn<Product>[] {
  const m = t();
  return [
    {
      key: 'name',
      header: m.common.product,
      // Cap the name below xl so a long product title can't push the money
      // and status columns off a 1024px screen (it truncates, title= has it).
      className: 'max-w-[240px] xl:max-w-none',
      cell: (p) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <ProductThumb product={p} onClick={() => h.onEditImage(p)} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink" title={p.name}>
              {p.name}
            </span>
            <span className="block truncate text-xs text-muted xl:hidden">{h.categoryName(p.categoryId)}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      width: 'w-32',
      hideBelow: 'xl',
      cell: (p) =>
        p.sku ? <span className="font-mono text-xs text-muted">{p.sku}</span> : <span className="text-subtle">—</span>,
    },
    {
      key: 'category',
      header: m.common.category,
      width: 'w-40',
      hideBelow: 'xl',
      cell: (p) => <span className="block truncate text-muted">{h.categoryName(p.categoryId)}</span>,
    },
    {
      key: 'price',
      header: m.products.colPrice,
      numeric: true,
      width: 'w-40',
      cell: (p) => (
        <span className="flex flex-col items-end">
          <InlineEditCell
            value={p.price}
            display={formatNumber(p.price)}
            unit={m.common.som}
            ariaLabel={m.products.priceAria(p.name)}
            onSave={(v) => h.onSavePrice(p, v)}
          />
          <DiscountTag item={p} />
        </span>
      ),
    },
    {
      key: 'stock',
      header: m.common.stock,
      numeric: true,
      width: 'w-36',
      cell: (p) => {
        const tone = stockTone(p.stock, h.threshold);
        return (
          <InlineEditCell
            value={p.stock}
            display={formatNumber(p.stock)}
            unit={m.units[p.unit] ?? p.unit}
            ariaLabel={m.products.stockAria(p.name, tone.label)}
            valueClassName={tone.text}
            onSave={(v) => h.onSaveStock(p, v)}
          />
        );
      },
    },
    {
      key: 'status',
      header: m.common.status,
      width: 'w-32',
      cell: (p) => <ProductStatusBadge status={p.status} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">{m.common.actions}</span>,
      align: 'right',
      width: 'w-20',
      cell: (p) => <RowActions product={p} busy={h.statusBusyId === p.id} h={h} />,
    },
  ];
}
