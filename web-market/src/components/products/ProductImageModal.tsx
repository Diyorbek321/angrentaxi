'use client';

import { useState } from 'react';
import { marketApi, Product } from '@/lib/api';
import { catalogImageForm, catalogImageSrc, ImageChange } from '@/lib/catalog-image';
import { errorMessage } from '@/lib/utils';
import { ImagePicker } from '@/components/ImagePicker';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/** Mavjud mahsulot rasmini yuklash, almashtirish yoki olib tashlash. */
export function ProductImageModal({
  product,
  onClose,
  onSaved,
  onError,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [image, setImage] = useState<ImageChange>({ kind: 'keep' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (image.kind === 'set') {
        await marketApi.uploadProductImage(product.id, await catalogImageForm(image.file));
      } else if (image.kind === 'remove') {
        await marketApi.removeProductImage(product.id);
      }
      await onSaved();
    } catch (err) {
      onError(errorMessage(err, 'Rasmni saqlab boʻlmadi'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Mahsulot rasmi" subtitle={product.name} size="md">
      <div className="space-y-4">
        <ImagePicker
          label="Rasm"
          currentSrc={catalogImageSrc(product.imageKey)}
          value={image}
          onChange={setImage}
          aspectClassName="aspect-square"
        />
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="button" disabled={image.kind === 'keep'} isLoading={saving} onClick={save}>
            Saqlash
          </Button>
        </div>
      </div>
    </Modal>
  );
}
