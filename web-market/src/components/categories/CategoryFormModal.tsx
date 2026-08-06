'use client';

import { useState } from 'react';
import { marketApi, type MarketCategory } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { EmojiPicker } from '@/components/products/EmojiPicker';

export interface CategoryFormModalProps {
  /** `null` opens the form empty, for a new category. */
  category: MarketCategory | null;
  /** Used as the new category's sortOrder — appended to the end of the list. */
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function CategoryFormModal({
  category,
  nextSortOrder,
  onClose,
  onSaved,
}: CategoryFormModalProps) {
  const { toast } = useToast();
  const isEdit = category !== null;

  const [name, setName] = useState(category?.name ?? '');
  const [emoji, setEmoji] = useState(category?.emoji ?? '🛒');
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
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
        await marketApi.updateCategory(category.id, { name: name.trim(), emoji, isActive });
      } else {
        await marketApi.createCategory({
          name: name.trim(),
          emoji,
          sortOrder: nextSortOrder,
        });
      }
      toast({
        title: isEdit ? 'Kategoriya yangilandi' : "Kategoriya qo'shildi",
        variant: 'success',
      });
      await onSaved();
    } catch {
      toast({ title: 'Saqlab bo‘lmadi', description: 'Qayta urinib ko‘ring.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}
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
          placeholder="Masalan: Sut mahsulotlari"
          autoFocus
        />

        <EmojiPicker value={emoji} onChange={setEmoji} />

        {/* Creation has no isActive field on the DTO — a new category is
            active by default, so the switch only appears when editing. */}
        {isEdit && (
          <div className="pt-1">
            <Switch checked={isActive} onChange={setIsActive} label="Kategoriya faolligi">
              {isActive ? 'Faol' : 'Yashirilgan'}
            </Switch>
          </div>
        )}
      </div>
    </Modal>
  );
}
