'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export type BulkPriceMode = 'set' | 'pct';

export interface BulkPriceModalProps {
  count: number;
  onClose: () => void;
  onApply: (mode: BulkPriceMode, value: number) => Promise<void>;
}

export function BulkPriceModal({ count, onClose, onApply }: BulkPriceModalProps) {
  const [mode, setMode] = useState<BulkPriceMode>('set');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = parseFloat(value);
  const valid = !Number.isNaN(parsed);

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await onApply(mode, parsed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      title="Narxni ommaviy o'zgartirish"
      subtitle={`${count} ta mahsulotga qo'llaniladi`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Bekor qilish
          </Button>
          <Button onClick={submit} disabled={!valid} isLoading={saving}>
            Qo&apos;llash
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { key: 'set', label: 'Aniq narx' },
              { key: 'pct', label: 'Foizda (%)' },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setMode(option.key)}
              aria-pressed={mode === option.key}
              className={cn(
                'rounded-lg py-2 text-xs font-semibold border transition-colors',
                mode === option.key
                  ? 'border-primary/45 bg-primary/10 text-primary-700 dark:text-primary-300'
                  : 'border-line text-muted hover:bg-surface-2 hover:text-ink'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Input
          label={mode === 'set' ? "Yangi narx (so'm)" : "O'zgarish foizi"}
          hint={
            mode === 'set'
              ? 'Tanlangan mahsulotlarning hammasiga shu narx qo‘yiladi.'
              : 'Masalan: 15 — 15% qimmatlashadi, -10 — 10% arzonlashadi.'
          }
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          mono
          autoFocus
        />
      </div>
    </Modal>
  );
}
