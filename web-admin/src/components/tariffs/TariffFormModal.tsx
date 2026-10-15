'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Checkbox, Input, Modal } from '@/components/ui';
import { tariffsApi, type Tariff, type TariffCreateInput } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { meteredPriceField } from '@/lib/metered-price';

const tariffSchema = z.object({
  name: z.string().min(2, 'Kamida 2 ta harf'),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0, "Manfiy qiymat bo'lmasin"),
  pricePerKm: z.coerce.number().min(0, "Manfiy qiymat bo'lmasin"),
  meteredPricePerKm: meteredPriceField,
  pricePerMin: z.coerce.number().min(0, "Manfiy qiymat bo'lmasin"),
  minPrice: z.coerce.number().min(0, "Manfiy qiymat bo'lmasin"),
  maxPrice: z.coerce.number().min(0, "Manfiy qiymat bo'lmasin").optional(),
  isActive: z.boolean().optional(),
});

type TariffForm = z.infer<typeof tariffSchema>;

const EMPTY: TariffForm = {
  name: '',
  description: '',
  basePrice: 0,
  pricePerKm: 0,
  meteredPricePerKm: null,
  pricePerMin: 0,
  minPrice: 0,
  maxPrice: undefined,
  isActive: true,
};

interface TariffFormModalProps {
  open: boolean;
  /** `null` = create. */
  tariff: Tariff | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function TariffFormModal({ open, tariff, onClose, onSaved }: TariffFormModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TariffForm>({ resolver: zodResolver(tariffSchema) });

  useEffect(() => {
    if (!open) return;
    reset(
      tariff
        ? {
            name: tariff.name,
            description: tariff.description || '',
            basePrice: tariff.basePrice,
            pricePerKm: tariff.pricePerKm,
            meteredPricePerKm: tariff.meteredPricePerKm,
            pricePerMin: tariff.pricePerMin,
            minPrice: tariff.minPrice,
            maxPrice: tariff.maxPrice ?? undefined,
            isActive: tariff.isActive,
          }
        : EMPTY
    );
  }, [open, tariff, reset]);

  const save = async (data: TariffForm) => {
    setSaving(true);
    try {
      const payload: TariffCreateInput = {
        name: data.name,
        description: data.description,
        basePrice: data.basePrice,
        pricePerKm: data.pricePerKm,
        meteredPricePerKm: data.meteredPricePerKm,
        pricePerMin: data.pricePerMin,
        minPrice: data.minPrice,
        maxPrice: data.maxPrice,
        isActive: data.isActive ?? true,
      };
      if (tariff) {
        await tariffsApi.update(tariff.id, payload);
        toast({ title: 'Tarif yangilandi', variant: 'success' });
      } else {
        await tariffsApi.create(payload);
        toast({ title: 'Tarif yaratildi', variant: 'success' });
      }
      onClose();
      await onSaved();
    } catch {
      toast({ title: 'Xatolik', description: 'Tarifni saqlashda xatolik', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="lg"
      title={tariff ? 'Tarifni tahrirlash' : 'Yangi tarif'}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="tariff-form" isLoading={saving}>
            {tariff ? 'Saqlash' : 'Yaratish'}
          </Button>
        </>
      }
    >
      <form id="tariff-form" onSubmit={handleSubmit(save)} className="space-y-4" noValidate>
        <Input
          label="Tarif nomi"
          placeholder="Standart, Premium, Ekonom..."
          error={errors.name?.message}
          {...register('name')}
        />
        <Input label="Tavsif (ixtiyoriy)" placeholder="Qisqacha tavsif..." {...register('description')} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Boshlang'ich narx (so'm)"
            type="number"
            placeholder="5000"
            error={errors.basePrice?.message}
            {...register('basePrice')}
          />
          <Input
            label="Minimum narx (so'm)"
            type="number"
            placeholder="8000"
            error={errors.minPrice?.message}
            {...register('minPrice')}
          />
          <Input
            label="1 km narxi (so'm)"
            type="number"
            placeholder="1500"
            error={errors.pricePerKm?.message}
            {...register('pricePerKm')}
          />
          <Input
            label="1 min narxi (so'm)"
            type="number"
            placeholder="300"
            error={errors.pricePerMin?.message}
            {...register('pricePerMin')}
          />
          <Input
            label="Taksometr 1 km (ixtiyoriy)"
            type="number"
            placeholder="1800"
            hint="Manzilsiz safar uchun. Bo'sh — oddiy km narxi"
            error={errors.meteredPricePerKm?.message}
            {...register('meteredPricePerKm')}
          />
          <Input
            label="Maksimal narx (ixtiyoriy)"
            type="number"
            placeholder="50000"
            error={errors.maxPrice?.message}
            {...register('maxPrice')}
          />
        </div>
        <Checkbox label="Darhol faol qilish" {...register('isActive')} />
      </form>
    </Modal>
  );
}
