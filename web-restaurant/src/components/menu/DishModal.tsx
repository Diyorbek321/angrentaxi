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
    if (!name.trim()) next.name = 'Nomi majburiy';
    if (!price.trim() || Number(price) <= 0) next.price = "Narx 0 dan katta bo'lishi kerak";
    if (Number(prep) <= 0) next.prep = "Tayyorlash vaqti 0 dan katta bo'lishi kerak";
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
      toast({ title: 'Saqlab bo‘lmadi', description: errorMessage(err), variant: 'error' });
      setSaving(false);
      return;
    }
    // Rasm taomdan keyin: yangi taomning id'si faqat shu yerda ma'lum.
    // Rasm yiqilsa taom baribir saqlangan — buni aniq aytamiz.
    try {
      if (image.kind === 'set') await foodApi.uploadDishImage(savedId, await catalogImageForm(image.file));
      if (image.kind === 'remove') await foodApi.removeDishImage(savedId);
      toast({ title: dish ? 'Taom yangilandi' : "Taom qo'shildi", variant: 'success' });
    } catch (err) {
      toast({ title: 'Taom saqlandi, lekin rasm yangilanmadi', description: errorMessage(err), variant: 'error' });
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
      title={dish ? 'Taomni tahrirlash' : "Yangi taom qo'shish"}
      subtitle={dish ? dish.name : 'Menyuga yangi pozitsiya'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button isLoading={saving} onClick={save}>
            Saqlash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ImagePicker label="Rasm" currentSrc={catalogImageSrc(dish?.imageKey)} value={image} onChange={setImage} />
        <Input
          label="Nomi"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Masalan: Klassik burger"
          error={errors.name}
          autoFocus
        />
        <Textarea
          label="Tavsif"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Qisqacha tarkib va oʻziga xosligi"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Narxi (so'm)"
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
            label="Tayyorlash (daqiqa)"
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
          label="Kategoriya"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          placeholder={categories.length === 0 ? 'Avval kategoriya yarating' : undefined}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Input
          label="Teglar"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Achchiq, Vegetarian"
          hint="Vergul bilan ajrating"
        />
      </div>
    </Modal>
  );
}
