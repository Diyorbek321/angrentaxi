'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import { promoCodesApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error';
import { serviceTypesPayload, type PromoServiceType } from '@/lib/promo-service-types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ServiceTypePicker } from './ServiceTypePicker';
import { t } from '@/locales';

const optionalNumber = (message: string, max?: number) =>
  z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0 && (max == null || Number(v) <= max)), {
      message,
    });

/** Sxema render paytida quriladi — xabarlar faol tilda bo'lishi uchun. */
function buildSchema() {
  const m = t().promo.create;
  return z
    .object({
      code: z
        .string()
        .min(3, m.codeMin)
        .max(50, m.codeMax)
        .regex(/^[A-Za-z0-9_-]+$/, m.codeChars),
      discountPercent: optionalNumber(m.percentRange, 100),
      discountFixed: optionalNumber(m.positiveAmount),
      maxUses: optionalNumber(m.positiveNumber),
      minOrderAmount: optionalNumber(m.positiveAmount),
      expiresAt: z.string().optional(),
    })
    .refine((d) => d.discountPercent || d.discountFixed, {
      message: m.discountRequired,
      path: ['discountPercent'],
    })
    .refine((d) => !(d.discountPercent && d.discountFixed), {
      message: m.discountOnlyOne,
      path: ['discountFixed'],
    });
}

type FormData = z.infer<ReturnType<typeof buildSchema>>;

const num = (v?: string) => (v ? Number(v) : undefined);

/** Admin: yangi promokod (xizmat turlari bilan). POST /promo-codes — menejer formasi bilan bir xil shartnoma. */
export function CreatePromoCodeModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (code: string) => void | Promise<void>;
}) {
  const m = t();
  const c = m.promo.create;
  const [schema] = useState(buildSchema);
  const [serviceTypes, setServiceTypes] = useState<PromoServiceType[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const close = () => {
    setSubmitError(null);
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    const code = data.code.toUpperCase();
    try {
      await promoCodesApi.create({
        code,
        discountPercent: num(data.discountPercent),
        discountFixed: num(data.discountFixed),
        maxUses: num(data.maxUses),
        minOrderAmount: num(data.minOrderAmount),
        expiresAt: data.expiresAt || undefined,
        ...serviceTypesPayload(serviceTypes),
      });
      reset();
      setServiceTypes([]);
      await onCreated(code);
    } catch (err) {
      setSubmitError(apiErrorMessage(err, c.createFailed));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={c.title} subtitle={c.subtitle}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden />
            <p className="text-[13px] text-danger-dark dark:text-danger-light">{submitError}</p>
          </div>
        )}
        <Input
          label={c.code}
          placeholder="ANGREN10"
          mono
          hint={c.codeHint}
          {...register('code')}
          error={errors.code?.message}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={c.discountPercent}
            type="number"
            placeholder="10"
            {...register('discountPercent')}
            error={errors.discountPercent?.message}
          />
          <Input
            label={c.discountFixed}
            type="number"
            placeholder="5000"
            {...register('discountFixed')}
            error={errors.discountFixed?.message}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={c.maxUses}
            type="number"
            placeholder="100"
            {...register('maxUses')}
            error={errors.maxUses?.message}
          />
          <Input
            label={c.minOrder}
            type="number"
            placeholder="0"
            {...register('minOrderAmount')}
            error={errors.minOrderAmount?.message}
          />
        </div>
        <ServiceTypePicker value={serviceTypes} onChange={setServiceTypes} disabled={isSubmitting} />
        <Input
          label={c.expiresAt}
          type="date"
          hint={c.expiresAtHint}
          {...register('expiresAt')}
          error={errors.expiresAt?.message}
        />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={close}>
            {m.common.cancel}
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {c.submit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
