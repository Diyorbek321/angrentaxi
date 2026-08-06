'use client';

import { Minus, Plus } from 'lucide-react';
import { cn, hueSwatch } from '@/lib/utils';
import { UNIT_LABEL } from '@/lib/format';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import type { Product } from '@/lib/api';

export interface StockTableProps {
  products: Product[];
  threshold: number;
  /** Absolute new stock value — there is no delta endpoint, see the page. */
  onSetStock: (product: Product, stock: number) => void;
  busyId: string | null;
}

const STEP = 5;

export function StockTable({ products, threshold, onSetStock, busyId }: StockTableProps) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Mahsulot</TH>
          <TH align="right">Zaxira</TH>
          <TH align="right">Chegara</TH>
          <TH>Holat</TH>
          <TH align="center">To&apos;ldirish</TH>
        </TR>
      </THead>
      <TBody>
        {products.map((product) => {
          const out = product.stock === 0;
          const low = !out && product.stock <= threshold;
          const busy = busyId === product.id;

          return (
            <TR key={product.id} tone={out ? 'danger' : low ? 'warn' : 'default'}>
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

              <TD align="right">
                <span
                  className={cn(
                    'font-mono font-bold tabular-nums',
                    out ? 'text-danger' : low ? 'text-warn-dark dark:text-warn-light' : 'text-ink'
                  )}
                >
                  {product.stock}
                </span>
                <span className="text-2xs text-subtle ml-1">{UNIT_LABEL[product.unit]}</span>
              </TD>

              <TD align="right" mono className="text-muted">
                {threshold}
              </TD>

              <TD>
                {out ? (
                  <Badge variant="danger" size="sm">
                    Zaxira tugagan
                  </Badge>
                ) : low ? (
                  <Badge variant="warning" size="sm">
                    Zaxira kam
                  </Badge>
                ) : (
                  <Badge variant="success" size="sm">
                    Yetarli
                  </Badge>
                )}
              </TD>

              <TD>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSetStock(product, Math.max(0, product.stock - STEP))}
                    disabled={busy || product.stock === 0}
                    aria-label={`${product.name} — zaxirani ${STEP} ga kamaytirish`}
                    className="h-8 w-8 rounded-lg border border-line bg-surface text-muted hover:text-ink hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center transition-colors"
                  >
                    <Minus size={14} />
                  </button>

                  <input
                    type="number"
                    min={0}
                    key={`${product.id}-${product.stock}`}
                    defaultValue={product.stock}
                    disabled={busy}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (!Number.isNaN(value) && value !== product.stock) {
                        onSetStock(product, Math.max(0, value));
                      }
                    }}
                    aria-label={`${product.name} — yangi zaxira`}
                    className="w-16 text-center bg-surface border border-line rounded-lg px-1 py-1 text-sm font-mono tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  />

                  <button
                    type="button"
                    onClick={() => onSetStock(product, product.stock + STEP)}
                    disabled={busy}
                    aria-label={`${product.name} — zaxirani ${STEP} ga oshirish`}
                    className="h-8 w-8 rounded-lg border border-primary/30 bg-primary/10 text-primary-700 dark:text-primary-300 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
