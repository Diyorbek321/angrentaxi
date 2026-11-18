'use client';

import { useState } from 'react';
import { foodApi, Dish, MenuCategory } from '@/lib/api';
import { errorMessage } from '@/hooks/useAsyncData';
import { catalogImageForm, catalogImageSrc, ImageChange } from '@/lib/catalog-image';
import { ImagePicker } from '@/components/ImagePicker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { t } from '@/locales';

interface Errors {
  name?: string;
  price?: string;
  prep?: string;
}

export function DishModal({
  dish,
  categories,
  onClose,
  onSaved,
}: {
  dish: Dish | null;
  categories: MenuCategory[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const m = t();
  const dm = m.dish;
  const { toast } = useToast();
  const [name, setName] = useState(dish?.name ?? '');
  const [description, setDescription] = useState(dish?.description ?? '');
  const [price, setPrice] = useState(dish ? String(dish.price) : '');
  const [prep, setPrep] = useState(dish ? String(dish.prepMinutes) : '12');
  const [categoryId, setCategoryId] = useState(dish?.categoryId ?? categories[0]?.id ?? '');
  const [tags, setTags] = useState(dish?.tags.join(', ') ?? '');
  const [image, setImage] = useState<ImageChange>({ kind: 'keep' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const validate = () => {
    const next: Errors = {};
    if (!name.trim()) next.name = dm.nameRequired;
    if (!price.trim() || Number(price) <= 0) next.price = dm.pricePositive;
    if (Number(prep) <= 0) next.prep = dm.prepPositive;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    // ⚠️ Faqat backend kutayotgan maydonlar yuboriladi — `forbidNonWhitelisted`.
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: Number(price),
      prepMinutes: Number(prep) || 10,
      categoryId: categoryId || undefined,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    let savedId: string;
    try {
      const res = dish ? await foodApi.updateDish(dish.id, payload) : await foodApi.createDish(payload);
      savedId = res.data.data.id;
    } catch (err) {
      toast({ title: m.common.saveFailedAlt, description: errorMessage(err), variant: 'error' });
      setSaving(false);
      return;
    }
    // Rasm taomdan keyin: yangi taomning id'si faqat shu yerda ma'lum.
    // Rasm yiqilsa taom baribir saqlangan — buni aniq aytamiz.
    try {
      if (image.kind === 'set') await foodApi.uploadDishImage(savedId, await catalogImageForm(image.file));
      if (image.kind === 'remove') await foodApi.removeDishImage(savedId);
      toast({ title: dish ? dm.updated : dm.added, variant: 'success' });
    } catch (err) {
      toast({ title: dm.imageFailed, description: errorMessage(err), variant: 'error' });
    } finally {
      setSaving(false);
    }
    await onSaved();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={dish ? dm.editTitle : dm.newTitle}
      subtitle={dish ? dish.name : dm.newSubtitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {m.common.cancel}
          </Button>
          <Button isLoading={saving} onClick={save}>
            {m.common.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ImagePicker label={dm.image} currentSrc={catalogImageSrc(dish?.imageKey)} value={image} onChange={setImage} />
        <Input
          label={m.common.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={dm.namePlaceholder}
          error={errors.name}
          autoFocus
        />
        <Textarea
          label={dm.description}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={dm.descriptionPlaceholder}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={dm.price}
            type="number"
            min={0}
            inputMode="numeric"
            className="num"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="32000"
            error={errors.price}
          />
          <Input
            label={dm.prep}
            type="number"
            min={1}
            inputMode="numeric"
            className="num"
            value={prep}
            onChange={(e) => setPrep(e.target.value)}
            placeholder="12"
            error={errors.prep}
          />
        </div>
        <Select
          label={dm.category}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          placeholder={categories.length === 0 ? dm.createCategoryFirst : undefined}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Input
          label={dm.tags}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={dm.tagsPlaceholder}
          hint={dm.tagsHint}
        />
      </div>
    </Modal>
  );
}
