'use client';

import { useMemo, useState } from 'react';
import { coveredItems, discountLabel, pricePreview, type PromotionForm } from '@/lib/promotions';
import { Badge } from '@/components/ui/Badge';
import { MoneyText } from '@/components/ui/MoneyText';
import { Select } from '@/components/ui/Select';
import type { PromotionCatalogItem, PromotionVocabulary } from './types';
import { t } from '@/locales';

/**
 * Mijoz ilovasida narx qanday ko'rinadi: asl narx chizilgan, yakuniy narx
 * qalin, yonida chegirma badge'i. Qamrovdagi istalgan pozitsiyani tanlash mumkin.
 */
export function PricePreview({
  form,
  items,
  vocab,
}: {
  form: PromotionForm;
  items: readonly PromotionCatalogItem[];
  vocab: PromotionVocabulary;
}) {
  const m = t().promotions.preview;
  const covered = useMemo(() => coveredItems(form, items), [form, items]);
  const [pickedId, setPickedId] = useState<string>('');
  const item = covered.find((i) => i.id === pickedId) ?? covered[0] ?? null;
  const value = Number(form.discountValue);
  const preview = item ? pricePreview(Number(item.price), form.discountType, Number.isFinite(value) ? value : 0) : null;

  return (
    <section aria-label={m.aria} className="rounded-ds-sm border border-line bg-surface-2/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-subtle">{m.title}</p>
        {covered.length > 1 && (
          <Select
            aria-label={vocab.previewSelect}
            size="sm"
            value={item?.id ?? ''}
            onChange={(e) => setPickedId(e.target.value)}
            wrapperClassName="w-48"
            options={covered.map((i) => ({ value: i.id, label: i.name }))}
          />
        )}
      </div>

      {!item || !preview ? (
        <p className="mt-2 text-[13px] text-muted">
          {vocab.previewEmpty}
        </p>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-body font-medium text-ink">{item.name}</span>
          <span className="flex shrink-0 items-baseline gap-2">
            {preview.hasDiscount ? (
              <>
                <Badge variant="success" size="sm">
                  {discountLabel(form.discountType, value)}
                </Badge>
                <MoneyText value={preview.original} currency={false} className="text-[13px] text-subtle line-through" />
                <MoneyText value={preview.final} className="text-title font-semibold text-ink" />
              </>
            ) : (
              <MoneyText value={preview.original} className="text-title font-semibold text-ink" />
            )}
          </span>
        </div>
      )}
    </section>
  );
}
