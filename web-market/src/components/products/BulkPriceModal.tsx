'use client';

import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { Product } from '@/lib/api';
import { moneyShort } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

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
      setFieldError('Raqam kiriting');
      return;
    }
    if (mode === 'set' && num < 0) {
      setFieldError('Narx manfiy bo‘lolmaydi');
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
      title="Narxni ommaviy o'zgartirish"
      subtitle={`Faqat tanlangan ${products.length} ta mahsulotga qo'llanadi`}
      size="lg"
    >
      {step === 'form' ? (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="O'zgartirish usuli" className="flex gap-2">
            {(
              [
                { key: 'set', label: 'Aniq narx' },
                { key: 'pct', label: 'Foizda (%)' },
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
                  'flex-1 rounded-ds-sm border py-2 text-caption font-bold transition-colors duration-fast',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
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
            mono
            autoFocus
            label={mode === 'set' ? "Yangi narx (so'm)" : "O'zgarish foizi"}
            hint={
              mode === 'pct'
                ? 'Masalan: -10 (arzonlashtirish) yoki 15 (qimmatlashtirish)'
                : "Tanlangan barcha mahsulotlarga BIR XIL narx qo'yiladi"
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
              Bekor qilish
            </Button>
            <Button
              className="flex-1"
              disabled={!value}
              onClick={toPreview}
              rightIcon={<ArrowRight size={14} aria-hidden />}
            >
              Ko&apos;rib chiqish
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-body text-muted">
            {mode === 'set'
              ? `Barcha ${products.length} ta tanlangan mahsulotga ${moneyShort(Math.max(0, Math.round(num)))} so'm narx qo'yiladi.`
              : `Tanlangan ${products.length} ta mahsulot narxi ${num > 0 ? `+${num}` : num}% ga o'zgartiriladi.`}{' '}
            <span className="font-semibold text-ink">{changedCount} ta narx o&apos;zgaradi.</span>
          </p>

          <div className="max-h-64 overflow-y-auto rounded-ds-sm border border-line">
            <div className="grid grid-cols-[minmax(0,1fr)_110px_20px_110px] items-center gap-2 border-b border-line bg-surface-2 px-3 py-2 text-micro uppercase text-muted">
              <span>Mahsulot</span>
              <span className="text-right">Hozirgi</span>
              <span aria-hidden />
              <span className="text-right">Yangi</span>
            </div>
            <ul className="divide-y divide-divider">
              {changes.map(({ product: p, newPrice }) => (
                <li
                  key={p.id}
                  className="grid grid-cols-[minmax(0,1fr)_110px_20px_110px] items-center gap-2 px-3 py-2"
                >
                  <span className="truncate text-caption font-semibold text-ink">{p.name}</span>
                  <span className="text-right font-mono text-caption tabular-nums text-muted">
                    {moneyShort(p.price)}
                  </span>
                  <ArrowRight size={12} aria-hidden className="text-subtle" />
                  <span
                    className={clsx(
                      'text-right font-mono text-caption tabular-nums font-bold',
                      newPrice === p.price ? 'text-muted' : 'text-primary-text'
                    )}
                  >
                    {moneyShort(newPrice)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2.5">
            <Button variant="secondary" className="flex-1" onClick={() => setStep('form')}>
              Orqaga
            </Button>
            <Button
              className="flex-1"
              isLoading={saving}
              disabled={changedCount === 0}
              onClick={() => void apply()}
            >
              Qo&apos;llash ({changedCount} ta)
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
