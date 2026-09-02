'use client';

import { useState } from 'react';
import { marketApi, MarketCategory, ProductUnit } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';

const UNIT_OPTIONS = [
  { value: 'dona', label: 'dona' },
  { value: 'kg', label: 'kg' },
  { value: 'litr', label: 'litr' },
];

export function AddProductModal({
  isOpen,
  categories,
  onClose,
  onCreated,
  onError,
}: {
  isOpen: boolean;
  categories: MarketCategory[];
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState<ProductUnit>('dona');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await marketApi.createProduct({
        name: name.trim(),
        sku: sku.trim() || undefined,
        price: Number(price) || 0,
        stock: Number(stock) || 0,
        unit,
        categoryId: categoryId || undefined,
      });
      setName('');
      setSku('');
      setPrice('');
      setStock('');
      await onCreated();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yangi mahsulot" size="lg">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input
          label="Nomi"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Masalan: Guruch Lazer 1kg"
        />
        <Input
          label="SKU / Shtrix-kod"
          mono
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="GRC-1002"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Narx (so'm)"
            type="number"
            mono
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
          />
          <Input
            label="Zaxira"
            type="number"
            mono
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="0"
          />
          <Select
            label="Birlik"
            options={UNIT_OPTIONS}
            value={unit}
            onChange={(e) => setUnit(e.target.value as ProductUnit)}
          />
        </div>
        <Select
          label="Kategoriya"
          placeholder={categories.length ? 'Kategoriyani tanlang' : 'Kategoriya yo’q'}
          options={categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          hint={categories.length ? undefined : "Avval kategoriya qo'shing"}
        />

        <div className="flex justify-end gap-2.5 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={!name.trim()} isLoading={saving}>
            Qo&apos;shish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
