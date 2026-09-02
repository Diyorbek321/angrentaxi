'use client';

import { useEffect, useState } from 'react';
import type { MarketCategory } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

/** Bitta modal — yaratish ham, tahrirlash ham (`category` berilsa). */
export function CategoryModal({
  isOpen,
  category,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  category: MarketCategory | null;
  onClose: () => void;
  onSave: (data: { name: string; emoji: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🛒');
  const [saving, setSaving] = useState(false);

  // Modal ochilganda maydonlar tahrirlanayotgan kategoriyadan to'ldiriladi.
  useEffect(() => {
    if (!isOpen) return;
    setName(category?.name ?? '');
    setEmoji(category?.emoji ?? '🛒');
  }, [isOpen, category]);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), emoji: emoji || '🛒' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={category ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}
      subtitle={category?.name}
      size="sm"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex gap-3">
          <div className="w-20">
            <Input
              label="Belgi"
              value={emoji}
              maxLength={2}
              onChange={(e) => setEmoji(e.target.value)}
              className="text-center text-lg"
            />
          </div>
          <div className="flex-1">
            <Input
              label="Kategoriya nomi"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masalan: Ichimliklar"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={!name.trim()} isLoading={saving}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
