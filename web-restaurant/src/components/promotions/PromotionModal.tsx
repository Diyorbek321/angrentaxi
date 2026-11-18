'use client';

import { useMemo, useState } from 'react';
import {
  DESCRIPTION_MAX,
  discountTypeLabel,
  PERCENT_MAX,
  PERCENT_MIN,
  TITLE_MAX,
  emptyPromotionForm,
  promotionToForm,
  toPromotionPayload,
  toggleId,
  validatePromotion,
  type DiscountType,
  type Promotion,
  type PromotionForm,
  type PromotionFormErrors,
  type PromotionPayload,
  type PromotionScope,
} from '@/lib/promotions';
import { formatMoney, formatNumber } from '@/lib/format';
import { intlLocale } from '@/lib/i18n/core';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { PricePreview } from './PricePreview';
import type { PromotionCatalog, PromotionVocabulary } from './types';
import { t } from '@/locales';

const DISCOUNT_TYPES: ReadonlyArray<DiscountType> = ['percent', 'fixed'];

export function PromotionModal({
  promotion,
  catalog,
  vocab,
  onClose,
  onSubmit,
}: {
  /** `null` — yangi aksiya. */
  promotion: Promotion | null;
  catalog: PromotionCatalog;
  vocab: PromotionVocabulary;
  onClose: () => void;
  /** Xato bo'lsa throw qiladi — modal ochiq qoladi. */
  onSubmit: (payload: PromotionPayload) => Promise<void>;
}) {
  const m = t();
  const pm = m.promotions.modal;
  const typeItems = DISCOUNT_TYPES.map((value) => ({ value, label: discountTypeLabel(value) }));
  const [form, setForm] = useState<PromotionForm>(() =>
    promotion ? promotionToForm(promotion) : emptyPromotionForm()
  );
  const [errors, setErrors] = useState<PromotionFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [itemQuery, setItemQuery] = useState('');

  const set = <K extends keyof PromotionForm>(key: K, value: PromotionForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const scopeItems = useMemo(
    () =>
      (['all', 'category', 'items'] as const).map((value) => ({
        value,
        label: value === 'all' ? vocab.allItems : value === 'category' ? pm.categories : vocab.selectedItems,
      })),
    [vocab, pm]
  );

  const q = itemQuery.trim().toLocaleLowerCase(intlLocale());
  const visibleItems = catalog.items.filter((i) => !q || i.name.toLocaleLowerCase(intlLocale()).includes(q));

  const submit = async () => {
    const next = validatePromotion(form, catalog.items);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSubmitting(true);
    try {
      await onSubmit(toPromotionPayload(form));
    } catch {
      // Xato toast'ini chaqiruvchi ko'rsatgan — modal ochiq qoladi, kiritilgan ma'lumot saqlanadi.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      title={promotion ? pm.editTitle : pm.newTitle}
      subtitle={pm.subtitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {m.common.cancel}
          </Button>
          <Button isLoading={submitting} onClick={() => void submit()}>
            {promotion ? m.common.save : pm.create}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          label={m.common.name}
          value={form.title}
          maxLength={TITLE_MAX}
          placeholder={pm.namePlaceholder}
          onChange={(e) => set('title', e.target.value)}
          error={errors.title}
          hint={`${form.title.trim().length}/${TITLE_MAX}`}
          autoFocus
        />
        <Textarea
          label={pm.description}
          rows={2}
          value={form.description}
          maxLength={DESCRIPTION_MAX}
          onChange={(e) => set('description', e.target.value)}
          error={errors.description}
          hint={`${form.description.trim().length}/${DESCRIPTION_MAX}`}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">{pm.discountType}</span>
            <SegmentedControl
              items={typeItems}
              value={form.discountType}
              onChange={(v) => set('discountType', v)}
              label={pm.discountType}
              fullWidth
            />
          </div>
          <Input
            label={form.discountType === 'percent' ? pm.percent : pm.amount}
            type="number"
            inputMode="numeric"
            min={form.discountType === 'percent' ? PERCENT_MIN : 1}
            max={form.discountType === 'percent' ? PERCENT_MAX : undefined}
            value={form.discountValue}
            onChange={(e) => set('discountValue', e.target.value)}
            rightElement={<span className="text-xs text-muted">{form.discountType === 'percent' ? '%' : m.common.som}</span>}
            error={errors.discountValue}
            hint={
              form.discountType === 'percent'
                ? `${PERCENT_MIN}–${PERCENT_MAX}%`
                : vocab.fixedHint
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">{pm.scope}</span>
          <SegmentedControl
            items={scopeItems}
            value={form.scope}
            onChange={(v: PromotionScope) => set('scope', v)}
            label={pm.scopeAria}
            fullWidth
          />

          {form.scope === 'category' && (
            <fieldset className="rounded-ds-sm border border-line">
              <legend className="sr-only">{pm.categories}</legend>
              {catalog.categories.length === 0 ? (
                <p className="p-3 text-[13px] text-muted">{pm.noCategories}</p>
              ) : (
                <ul className="max-h-48 divide-y divide-line overflow-y-auto">
                  {catalog.categories.map((c) => {
                    const count = catalog.items.filter((i) => i.categoryId === c.id).length;
                    return (
                      <li key={c.id} className="px-3 py-2">
                        <Checkbox
                          checked={form.categoryIds.includes(c.id)}
                          onCheckedChange={() => set('categoryIds', toggleId(form.categoryIds, c.id))}
                          label={c.name}
                          description={vocab.itemCount(formatNumber(count))}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
          )}
          {form.scope === 'category' && errors.categoryIds && (
            <p role="alert" className="text-xs text-danger-dark dark:text-danger-light">{errors.categoryIds}</p>
          )}

          {form.scope === 'items' && (
            <fieldset className="rounded-ds-sm border border-line">
              <legend className="sr-only">{vocab.itemsLegend}</legend>
              <div className="flex items-center gap-2 border-b border-line p-2">
                <SearchInput
                  value={itemQuery}
                  onChange={setItemQuery}
                  onClear={() => setItemQuery('')}
                  placeholder={vocab.searchPlaceholder}
                  aria-label={vocab.searchAria}
                  size="sm"
                  wrapperClassName="flex-1"
                />
                <span className="num shrink-0 text-xs text-muted">{pm.selectedCount(formatNumber(form.itemIds.length))}</span>
              </div>
              {visibleItems.length === 0 ? (
                <p className="p-3 text-[13px] text-muted">
                  {catalog.items.length === 0 ? vocab.catalogEmpty : pm.noSearchResults}
                </p>
              ) : (
                <ul className="max-h-56 divide-y divide-line overflow-y-auto">
                  {visibleItems.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <Checkbox
                        checked={form.itemIds.includes(i.id)}
                        onCheckedChange={() => set('itemIds', toggleId(form.itemIds, i.id))}
                        label={i.name}
                      />
                      <span className="num shrink-0 text-xs text-muted">{formatMoney(i.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          )}
          {form.scope === 'items' && errors.itemIds && (
            <p role="alert" className="text-xs text-danger-dark dark:text-danger-light">{errors.itemIds}</p>
          )}
        </div>

        <PricePreview form={form} items={catalog.items} vocab={vocab} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label={pm.minOrder}
            type="number"
            inputMode="numeric"
            min={0}
            value={form.minOrderAmount}
            onChange={(e) => set('minOrderAmount', e.target.value)}
            rightElement={<span className="text-xs text-muted">{m.common.som}</span>}
            error={errors.minOrderAmount}
          />
          <Input
            label={pm.startsAt}
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => set('startsAt', e.target.value)}
            error={errors.startsAt}
          />
          <Input
            label={pm.endsAt}
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => set('endsAt', e.target.value)}
            error={errors.endsAt}
            hint={pm.endsAtHint}
          />
        </div>

        <Switch
          checked={form.isActive}
          onCheckedChange={(v) => set('isActive', v)}
          label={form.isActive ? pm.activeOn : pm.activeOff}
        />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
