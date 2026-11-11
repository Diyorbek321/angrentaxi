'use client';

import { useState } from 'react';
import { marketApi, MarketCategory, ProductUnit } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import { catalogImageForm, ImageChange } from '@/lib/catalog-image';
import { ImagePicker } from '@/components/ImagePicker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { t } from '@/locales';

const UNITS: readonly ProductUnit[] = ['dona', 'kg', 'litr'];

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
  const m = t();
  const unitOptions = UNITS.map((u) => ({ value: u, label: m.units[u] ?? u }));
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState<ProductUnit>('dona');
  const [categoryId, setCategoryId] = useState('');
  const [image, setImage] = useState<ImageChange>({ kind: 'keep' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    let createdId: string;
    try {
      const res = await marketApi.createProduct({
        name: name.trim(),
        sku: sku.trim() || undefined,
        price: Number(price) || 0,
        stock: Number(stock) || 0,
        unit,
        categoryId: categoryId || undefined,
      });
      createdId = res.data.data.id;
    } catch (err) {
      onError(errorMessage(err));
      setSaving(false);
      return;
    }
    // Rasm mahsulotdan keyin: id faqat shu yerda ma'lum. Rasm yiqilsa ham
    // mahsulot qo'shilgan — forma tozalanadi, xato alohida aytiladi.
    if (image.kind === 'set') {
      try {
        await marketApi.uploadProductImage(createdId, await catalogImageForm(image.file));
      } catch (err) {
        onError(m.products.addedImageFailed(errorMessage(err)));
      }
    }
    setName('');
    setSku('');
    setPrice('');
    setStock('');
    setImage({ kind: 'keep' });
    setSaving(false);
    await onCreated();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={m.products.newProduct} size="lg">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <ImagePicker
          label={m.products.imageOptional}
          currentSrc={null}
          value={image}
          onChange={setImage}
          aspectClassName="aspect-[2/1]"
        />
        <Input
          label={m.products.name}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={m.products.namePlaceholder}
        />
        <Input
          label={m.products.sku}
          mono
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="GRC-1002"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label={m.products.priceSom}
            type="number"
            className="num"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
          />
          <Input
            label={m.common.stock}
            type="number"
            className="num"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="0"
          />
          <Select
            label={m.products.unit}
            options={unitOptions}
            value={unit}
            onChange={(e) => setUnit(e.target.value as ProductUnit)}
          />
        </div>
        <Select
          label={m.common.category}
          placeholder={categories.length ? m.products.pickCategory : m.products.noCategory}
          options={categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          hint={categories.length ? undefined : m.products.addCategoryFirst}
        />

        <div className="flex justify-end gap-2.5 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            {m.common.cancel}
          </Button>
          <Button type="submit" disabled={!name.trim()} isLoading={saving}>
            {m.products.addButton}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
