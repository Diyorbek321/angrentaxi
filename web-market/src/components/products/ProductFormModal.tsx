'use client';

import { useState } from 'react';
import { marketApi, type MarketCategory, type Product, type ProductUnit } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { EmojiPicker } from './EmojiPicker';

const UNIT_OPTIONS = [
  { value: 'dona', label: 'dona' },
  { value: 'kg', label: 'kg' },
  { value: 'litr', label: 'litr' },
];

export interface ProductFormModalProps {
  /** `null` opens the form empty, for a new product. */
  product: Product | null;
  categories: MarketCategory[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function ProductFormModal({
  product,
  categories,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const { toast } = useToast();
  const isEdit = product !== null;

  const [name, setName] = useState(product?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '');
  const [unit, setUnit] = useState<ProductUnit>(product?.unit ?? 'dona');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? '');
  const [emoji, setEmoji] = useState(product?.emoji ?? '🛒');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setNameError('Nomini kiriting');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await marketApi.updateProduct(product.id, {
          name: name.trim(),
          sku: sku.trim() || undefined,
          price: Math.max(0, Number(price) || 0),
          stock: Math.max(0, Number(stock) || 0),
          unit,
          categoryId: categoryId || undefined,
          emoji,
        });
      } else {
        await marketApi.createProduct({
          name: name.trim(),
          sku: sku.trim() || undefined,
          price: Math.max(0, Number(price) || 0),
          stock: Math.max(0, Number(stock) || 0),
          unit,
          categoryId: categoryId || undefined,
          emoji,
        });
      }
      toast({
        title: isEdit ? 'Mahsulot yangilandi' : "Mahsulot qo'shildi",
        variant: 'success',
      });
      await onSaved();
    } catch {
      toast({
        title: 'Saqlab bo‘lmadi',
        description: 'Qayta urinib ko‘ring.',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      title={isEdit ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
      subtitle={isEdit ? product.name : "Katalogga yangi mahsulot qo'shiladi"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Bekor qilish
          </Button>
          <Button onClick={submit} isLoading={saving}>
            {isEdit ? 'Saqlash' : "Qo'shish"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nomi"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
          error={nameError ?? undefined}
          placeholder="Masalan: Guruch Lazer 1kg"
          autoFocus
        />

        <Input
          label="SKU / Shtrix-kod"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="GRC-1002"
          mono
        />

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Narx (so'm)"
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            mono
          />
          <Input
            label="Zaxira"
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="0"
            mono
          />
          <Select
            label="Birlik"
            value={unit}
            onChange={(e) => setUnit(e.target.value as ProductUnit)}
            options={UNIT_OPTIONS}
          />
        </div>

        <Select
          label="Kategoriya"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))}
          placeholder={categories.length === 0 ? 'Kategoriya yo‘q' : undefined}
        />

        <EmojiPicker value={emoji} onChange={setEmoji} hue={product?.hue} />
      </div>
    </Modal>
  );
}
