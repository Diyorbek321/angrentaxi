'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Modal, useToast } from '@/components/ui';
import { apiErrorMessage, apiErrorTitle } from '@/lib/api-error';
import { intercityApi } from '@/lib/intercity-api';
import { validatePointForm, type FormErrors, type IntercityPoint, type IntercityPointForm } from '@/lib/intercity';

interface PointFormModalProps {
  open: boolean;
  /** `null` = yangi nuqta. */
  point: IntercityPoint | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

/** Maydonlar satr holida — foydalanuvchi "41," yozayotganda son NaN ga aylanmasin. */
interface Draft {
  name: string;
  centerLat: string;
  centerLng: string;
  radiusKm: string;
}

const EMPTY: Draft = { name: '', centerLat: '', centerLng: '', radiusKm: '5' };

const toForm = (draft: Draft): IntercityPointForm => ({
  name: draft.name.trim(),
  centerLat: Number(draft.centerLat),
  centerLng: Number(draft.centerLng),
  radiusKm: Number(draft.radiusKm),
});

export function PointFormModal({ open, point, onClose, onSaved }: PointFormModalProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<FormErrors<IntercityPointForm>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setDraft(
      point
        ? {
            name: point.name,
            centerLat: String(point.centerLat),
            centerLng: String(point.centerLng),
            radiusKm: String(point.radiusKm),
          }
        : EMPTY
    );
  }, [open, point]);

  const update = (key: keyof Draft, value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (errors[key]) setErrors(validatePointForm(toForm(next)));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const form = toForm(draft);
    const found = validatePointForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      if (point) {
        await intercityApi.updatePoint(point.id, form);
        toast({ title: 'Nuqta yangilandi', variant: 'success' });
      } else {
        await intercityApi.createPoint(form);
        toast({ title: 'Nuqta qoʻshildi', variant: 'success' });
      }
      onClose();
      await onSaved();
    } catch (err) {
      toast({
        title: apiErrorTitle(err, 'Saqlab boʻlmadi'),
        description: apiErrorMessage(err, 'Nuqtani saqlashda xatolik'),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={point ? 'Nuqtani tahrirlash' : 'Yangi nuqta'}
      description="Yoʻlovchini olish va tushirish manzili shu doira ichida boʻlishi kerak."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="intercity-point-form" isLoading={saving}>
            {point ? 'Saqlash' : 'Qoʻshish'}
          </Button>
        </>
      }
    >
      <form id="intercity-point-form" onSubmit={save} className="space-y-4" noValidate>
        <Input
          label="Nomi"
          placeholder="Angren, Rohat krugi (Toshkent)…"
          value={draft.name}
          error={errors.name}
          onChange={(e) => update('name', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Kenglik (lat)"
            inputMode="decimal"
            className="num"
            placeholder="41.0167"
            value={draft.centerLat}
            error={errors.centerLat}
            onChange={(e) => update('centerLat', e.target.value)}
          />
          <Input
            label="Uzunlik (lng)"
            inputMode="decimal"
            className="num"
            placeholder="70.1436"
            value={draft.centerLng}
            error={errors.centerLng}
            onChange={(e) => update('centerLng', e.target.value)}
          />
        </div>
        <Input
          label="Radius, km"
          type="number"
          inputMode="decimal"
          min={0.5}
          max={50}
          step={0.5}
          value={draft.radiusKm}
          error={errors.radiusKm}
          hint="Bekat yoki aylanma uchun 1–2 km, butun shahar uchun 8–15 km."
          onChange={(e) => update('radiusKm', e.target.value)}
          wrapperClassName="max-w-[12rem]"
        />
      </form>
    </Modal>
  );
}
