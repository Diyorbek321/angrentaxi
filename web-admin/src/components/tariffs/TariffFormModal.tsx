'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Checkbox, Input, Modal } from '@/components/ui';
import { tariffsApi, type Tariff, type TariffCreateInput } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { meteredPriceField } from '@/lib/metered-price';
import { t } from '@/locales';

/** Sxema funksiya ichida — xato matnlari joriy tilda chiqishi uchun. */
function tariffSchema() {
  const v = t().tariffs.form;
  const money = () => z.coerce.number().min(0, v.nonNegative);
  return z.object({
    name: z.string().min(2, v.minLetters),
    description: z.string().optional(),
    basePrice: money(),
    pricePerKm: money(),
    meteredPricePerKm: meteredPriceField,
    pricePerMin: money(),
    minPrice: money(),
    maxPrice: money().optional(),
    isActive: z.boolean().optional(),
  });
}

type TariffForm = z.infer<ReturnType<typeof tariffSchema>>;

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
  const m = t();
  const fm = m.tariffs.form;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TariffForm>({ resolver: zodResolver(tariffSchema()) });

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
        toast({ title: fm.updated, variant: 'success' });
      } else {
        await tariffsApi.create(payload);
        toast({ title: fm.created, variant: 'success' });
      }
      onClose();
      await onSaved();
    } catch {
      toast({ title: m.common.error, description: fm.saveError, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="lg"
      title={tariff ? fm.editTitle : fm.newTitle}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {m.common.cancel}
          </Button>
          <Button type="submit" form="tariff-form" isLoading={saving}>
            {tariff ? m.common.save : fm.create}
          </Button>
        </>
      }
    >
      <form id="tariff-form" onSubmit={handleSubmit(save)} className="space-y-4" noValidate>
        <Input
          label={fm.name}
          placeholder={fm.namePlaceholder}
          error={errors.name?.message}
          {...register('name')}
        />
        <Input label={fm.description} placeholder={fm.descriptionPlaceholder} {...register('description')} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={fm.basePrice}
            type="number"
            placeholder="5000"
            error={errors.basePrice?.message}
            {...register('basePrice')}
          />
          <Input
            label={fm.minPrice}
            type="number"
            placeholder="8000"
            error={errors.minPrice?.message}
            {...register('minPrice')}
          />
          <Input
            label={fm.pricePerKm}
            type="number"
            placeholder="1500"
            error={errors.pricePerKm?.message}
            {...register('pricePerKm')}
          />
          <Input
            label={fm.pricePerMin}
            type="number"
            placeholder="300"
            error={errors.pricePerMin?.message}
            {...register('pricePerMin')}
          />
          <Input
            label={fm.metered}
            type="number"
            placeholder="1800"
            hint={fm.meteredHint}
            error={errors.meteredPricePerKm?.message}
            {...register('meteredPricePerKm')}
          />
          <Input
            label={fm.maxPrice}
            type="number"
            placeholder="50000"
            error={errors.maxPrice?.message}
            {...register('maxPrice')}
          />
        </div>
        <Checkbox label={fm.activateNow} {...register('isActive')} />
      </form>
    </Modal>
  );
}
