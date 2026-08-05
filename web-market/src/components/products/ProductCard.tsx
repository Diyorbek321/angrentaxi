'use client';

import { Pencil } from 'lucide-react';
import { cn, hueSwatch } from '@/lib/utils';
import { formatMoney, formatStock } from '@/lib/format';
import { productStatusMeta } from '@/lib/orderStatus';
import { Switch } from '@/components/ui/Switch';
import type { Product } from '@/lib/api';

export interface ProductCardProps {
  product: Product;
  selected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
  onToggleActive: (next: boolean) => void;
  lowStockThreshold: number;
  busy?: boolean;
}

export function ProductCard({
  product,
  selected,
  onToggleSelected,
  onEdit,
  onToggleActive,
  lowStockThreshold,
  busy = false,
}: ProductCardProps) {
  const meta = productStatusMeta(product.status);
  const out = product.stock === 0;
  const low = !out && product.stock <= lowStockThreshold;

  return (
    <div
      className={cn(
        'surface-card p-3.5 flex flex-col gap-3 transition-colors',
        selected && 'border-primary/45 bg-primary/[0.04]'
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`${product.name} — tanlash`}
          className="mt-1 h-4 w-4 shrink-0 accent-primary cursor-pointer"
        />

        <div
          className="h-12 w-12 shrink-0 rounded-xl border flex items-center justify-center text-2xl"
          style={hueSwatch(product.hue)}
          aria-hidden
        >
          {product.emoji}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink line-clamp-2">{product.name}</p>
          {product.sku && (
            <p className="text-2xs text-subtle font-mono mt-0.5 truncate">{product.sku}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onEdit}
          aria-label={`${product.name} — tahrirlash`}
          className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-lg text-subtle hover:text-ink hover:bg-surface-2 transition-colors"
        >
          <Pencil size={13} />
        </button>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xs text-subtle">Narx</p>
          <p className="font-mono text-sm font-bold text-ink tabular-nums">
            {formatMoney(product.price)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xs text-subtle">Zaxira</p>
          <p
            className={cn(
              'font-mono text-sm font-bold tabular-nums',
              out ? 'text-danger' : low ? 'text-warn-dark dark:text-warn-light' : 'text-ink'
            )}
          >
            {formatStock(product.stock, product.unit)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-line">
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium', meta.chip)}>
          {meta.label}
        </span>
        <Switch
          size="sm"
          checked={product.status === 'active'}
          disabled={busy}
          onChange={onToggleActive}
          label={`${product.name} — sotuvda ko'rsatish`}
        >
          <span className="text-xs text-muted">Sotuvda</span>
        </Switch>
      </div>
    </div>
  );
}
