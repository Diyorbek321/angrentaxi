'use client';

import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { Product } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { t } from '@/locales';

export interface BulkPriceChange {
  id: string;
  newPrice: number;
}

type Mode = 'set' | 'pct';

function computePrice(product: Product, mode: Mode, value: number): number {
  return mode === 'set'
    ? Math.max(0, Math.round(value))
    : Math.max(0, Math.round(product.price * (1 + value / 100)));
}

/**
 * Ommaviy narx o'zgartirish — QO'LLASHDAN OLDIN ko'rib chiqish bilan:
 * har bir tanlangan mahsulot uchun eski → yangi narx ro'yxati chiqadi,
 * qamrov esa so'z bilan aniq yoziladi. "50 ta mahsulot narxini ko'r-ko'rona
 * almashtirish" tugmasi bo'lmaydi.
 */
export function BulkPriceModal({
  isOpen,
  products,
  onClose,
  onApply,
}: {
  isOpen: boolean;
  /** Faqat tanlangan mahsulotlar. */
  products: Product[];
  onClose: () => void;
  onApply: (changes: BulkPriceChange[]) => Promise<void>;
}) {
  const m = t();
  const b = m.bulkPrice;
  const [mode, setMode] = useState<Mode>('set');
  const [value, setValue] = useState('');
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const num = parseFloat(value);
  const valid = !Number.isNaN(num);

  const changes = useMemo(
    () =>
      valid
        ? products.map((p) => ({ product: p, newPrice: computePrice(p, mode, num) }))
        : [],
    [products, mode, num, valid]
  );
  const changedCount = changes.filter((c) => c.newPrice !== c.product.price).length;

  const close = () => {
    setStep('form');
    setFieldError(null);
    onClose();
  };

  const toPreview = () => {
    if (!valid) {
      setFieldError(m.products.enterNumber);
      return;
    }
    if (mode === 'set' && num < 0) {
      setFieldError(b.negative);
      return;
    }
    setFieldError(null);
    setStep('preview');
  };

  const apply = async () => {
    setSaving(true);
    try {
      await onApply(
        changes
          .filter((c) => c.newPrice !== c.product.price)
          .map((c) => ({ id: c.product.id, newPrice: c.newPrice }))
      );
      setValue('');
      setStep('form');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={b.title}
      subtitle={b.subtitle(products.length)}
      size="lg"
    >
      {step === 'form' ? (
        <div className="space-y-4">
          <div role="radiogroup" aria-label={b.methodAria} className="flex gap-2">
            {(
              [
                { key: 'set', label: b.exact },
                { key: 'pct', label: b.percent },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={mode === opt.key}
                onClick={() => {
                  setMode(opt.key);
                  setFieldError(null);
                }}
                className={clsx(
                  'h-8 flex-1 rounded-ds-sm border text-[13px] font-medium transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  mode === opt.key
                    ? 'border-primary bg-mint-tint text-primary-text'
                    : 'border-line text-muted hover:bg-surface-2 hover:text-ink'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Input
            type="number"
            className="num"
            autoFocus
            label={mode === 'set' ? b.newPrice : b.changePct}
            hint={
              mode === 'pct'
                ? b.pctHint
                : b.setHint
            }
            error={fieldError ?? undefined}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setFieldError(null);
            }}
          />

          <div className="flex gap-2.5">
            <Button variant="secondary" className="flex-1" onClick={close}>
              {m.common.cancel}
            </Button>
            <Button
              className="flex-1"
              disabled={!value}
              onClick={toPreview}
              rightIcon={<ArrowRight size={14} aria-hidden />}
            >
              {b.review}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {mode === 'set'
              ? b.setSummary(products.length, formatNumber(Math.max(0, Math.round(num))))
              : b.pctSummary(products.length, num > 0 ? `+${num}` : String(num))}{' '}
            <span className="font-semibold text-ink">{b.willChange(changedCount)}</span>
          </p>

          <div className="max-h-64 overflow-y-auto rounded-ds-sm border border-line">
            <div className="grid grid-cols-[minmax(0,1fr)_110px_20px_110px] items-center gap-2 border-b border-line bg-surface-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
              <span>{m.common.product}</span>
              <span className="text-right">{b.current}</span>
              <span aria-hidden />
              <span className="text-right">{b.new}</span>
            </div>
            <ul className="divide-y divide-divider">
              {changes.map(({ product: p, newPrice }) => (
                <li
                  key={p.id}
                  className="grid grid-cols-[minmax(0,1fr)_110px_20px_110px] items-center gap-2 px-3 py-2"
                >
                  <span className="truncate text-[13px] text-ink">{p.name}</span>
                  <span className="num text-right text-[13px] text-muted">
                    {formatNumber(p.price)}
                  </span>
                  <ArrowRight size={12} aria-hidden className="text-subtle" />
                  <span
                    className={clsx(
                      'num text-right text-[13px] font-medium',
                      newPrice === p.price ? 'text-muted' : 'text-primary-text'
                    )}
                  >
                    {formatNumber(newPrice)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2.5">
            <Button variant="secondary" className="flex-1" onClick={() => setStep('form')}>
              {b.back}
            </Button>
            <Button
              className="flex-1"
              isLoading={saving}
              disabled={changedCount === 0}
              onClick={() => void apply()}
            >
              {b.apply(changedCount)}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
