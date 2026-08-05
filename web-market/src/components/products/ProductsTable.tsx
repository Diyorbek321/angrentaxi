'use client';

import { Check, Pencil } from 'lucide-react';
import { cn, hueSwatch } from '@/lib/utils';
import { UNIT_LABEL } from '@/lib/format';
import { productStatusMeta } from '@/lib/orderStatus';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Switch } from '@/components/ui/Switch';
import type { MarketCategory, Product } from '@/lib/api';

export interface ProductsTableProps {
  products: Product[];
  categories: MarketCategory[];
  selected: Record<string, boolean>;
  onToggleSelected: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product, next: boolean) => void;
  /** Inline edits — the quick path the vendor already relies on. */
  onInlineChange: (product: Product, field: 'price' | 'stock', value: number) => void;
  savedFlags: Record<string, boolean>;
  lowStockThreshold: number;
}

export function ProductsTable({
  products,
  categories,
  selected,
  onToggleSelected,
  onToggleAll,
  allSelected,
  onEdit,
  onToggleActive,
  onInlineChange,
  savedFlags,
  lowStockThreshold,
}: ProductsTableProps) {
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—';

  return (
    <Table>
      <THead>
        <TR>
          <TH className="w-10">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleAll}
              aria-label="Barchasini tanlash"
              className="h-4 w-4 accent-primary cursor-pointer"
            />
          </TH>
          <TH>Mahsulot</TH>
          <TH>Kategoriya</TH>
          <TH align="right">Narx</TH>
          <TH align="right">Zaxira</TH>
          <TH>Holat</TH>
          <TH className="w-12" />
        </TR>
      </THead>
      <TBody>
        {products.map((product) => {
          const meta = productStatusMeta(product.status);
          const out = product.stock === 0;
          const low = !out && product.stock <= lowStockThreshold;

          return (
            <TR key={product.id} tone={out ? 'danger' : low ? 'warn' : 'default'}>
              <TD>
                <input
                  type="checkbox"
                  checked={!!selected[product.id]}
                  onChange={() => onToggleSelected(product.id)}
                  aria-label={`${product.name} — tanlash`}
                  className="h-4 w-4 accent-primary cursor-pointer"
                />
              </TD>

              <TD>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center text-lg"
                    style={hueSwatch(product.hue)}
                    aria-hidden
                  >
                    {product.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink truncate">
                      {product.name}
                    </span>
                    {product.sku && (
                      <span className="block text-2xs text-subtle font-mono truncate">
                        {product.sku}
                      </span>
                    )}
                  </span>
                </div>
              </TD>

              <TD className="text-muted text-sm">{categoryName(product.categoryId)}</TD>

              <TD align="right">
                <span className="inline-flex items-center gap-1.5 justify-end">
                  <input
                    type="number"
                    min={0}
                    defaultValue={product.price}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (!Number.isNaN(value) && value !== product.price) {
                        onInlineChange(product, 'price', Math.max(0, value));
                      }
                    }}
                    aria-label={`${product.name} — narx`}
                    className="w-24 text-right bg-surface border border-line rounded-lg px-2 py-1 text-sm font-mono tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  />
                  {savedFlags[`${product.id}-price`] && (
                    <Check size={13} className="text-primary shrink-0" />
                  )}
                </span>
              </TD>

              <TD align="right">
                <span className="inline-flex items-center gap-1.5 justify-end">
                  <input
                    type="number"
                    min={0}
                    defaultValue={product.stock}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (!Number.isNaN(value) && value !== product.stock) {
                        onInlineChange(product, 'stock', Math.max(0, value));
                      }
                    }}
                    aria-label={`${product.name} — zaxira`}
                    className={cn(
                      'w-20 text-right bg-surface border rounded-lg px-2 py-1 text-sm font-mono tabular-nums transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
                      out
                        ? 'border-danger/50 text-danger'
                        : low
                          ? 'border-warn/50 text-warn-dark dark:text-warn-light'
                          : 'border-line text-ink'
                    )}
                  />
                  <span className="text-2xs text-subtle w-7 text-left">
                    {UNIT_LABEL[product.unit]}
                  </span>
                  {savedFlags[`${product.id}-stock`] && (
                    <Check size={13} className="text-primary shrink-0" />
                  )}
                </span>
              </TD>

              <TD>
                <div className="flex items-center gap-2.5">
                  <Switch
                    size="sm"
                    checked={product.status === 'active'}
                    onChange={(next) => onToggleActive(product, next)}
                    label={`${product.name} — sotuvda ko'rsatish`}
                  />
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium whitespace-nowrap',
                      meta.chip
                    )}
                  >
                    {meta.label}
                  </span>
                </div>
              </TD>

              <TD>
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  aria-label={`${product.name} — tahrirlash`}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-subtle hover:text-ink hover:bg-surface-2 transition-colors"
                >
                  <Pencil size={13} />
                </button>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
