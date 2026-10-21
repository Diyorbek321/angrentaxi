'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Calculator, CheckCircle2, MapPin, Phone, User } from 'lucide-react';
import {
  createOrder,
  calculatePrice,
  getTariffs,
  Tariff,
  CalculatePriceResponse,
} from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { MoneyText } from '@/components/ui/MoneyText';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { PAYMENT_METHOD, paymentMethodLabels } from '@/lib/constants';
import { formatDistanceKm, formatMoney } from '@/lib/format';
import { t } from '@/locales';

const PAYMENT_VALUES = [
  PAYMENT_METHOD.CASH,
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.WALLET,
] as const;

// Mirrors the backend's own estimate (orders.service.ts haversineDistance +
// the 2.5 min/km rule) so the preview matches what the created order will show.
function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Funksiya ichida: validatsiya xabarlari joriy tilda olinadi.
function buildSchema() {
  const v = t().orders.form.validation;
  return z.object({
    passengerPhone: z
      .string()
      .min(9, v.phoneMin)
      .regex(/^\+?[\d\s-]+$/, v.phoneInvalid),
    passengerName: z.string().optional(),
    pickupAddress: z.string().min(3, v.pickupRequired),
    pickupLat: z
      .string()
      .refine((x) => !isNaN(parseFloat(x)), v.latInvalid)
      .optional()
      .or(z.literal('')),
    pickupLng: z
      .string()
      .refine((x) => !isNaN(parseFloat(x)), v.lngInvalid)
      .optional()
      .or(z.literal('')),
    dropoffAddress: z.string().min(3, v.dropoffRequired),
    dropoffLat: z
      .string()
      .refine((x) => !isNaN(parseFloat(x)), v.latInvalid)
      .optional()
      .or(z.literal('')),
    dropoffLng: z
      .string()
      .refine((x) => !isNaN(parseFloat(x)), v.lngInvalid)
      .optional()
      .or(z.literal('')),
    tariffId: z.string().min(1, v.tariffRequired),
    paymentMethod: z.enum(PAYMENT_VALUES),
    note: z.string().optional(),
  });
}

type FormData = z.infer<ReturnType<typeof buildSchema>>;

interface CreateOrderFormProps {
  onSuccess?: () => void;
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-semibold text-ink flex items-center gap-2 [&_svg]:text-subtle">
      {icon}
      {children}
    </h3>
  );
}

export function CreateOrderForm({ onSuccess }: CreateOrderFormProps) {
  const m = t();
  const f = m.orders.form;
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [tariffLoading, setTariffLoading] = useState(true);
  const [tariffError, setTariffError] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState<CalculatePriceResponse | null>(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(buildSchema()),
    defaultValues: {
      paymentMethod: 'cash',
    },
  });

  // Load tariffs
  useEffect(() => {
    getTariffs()
      .then(setTariffs)
      .catch(() => {
        console.error('Failed to load tariffs');
        setTariffError(true);
      })
      .finally(() => setTariffLoading(false));
  }, []);

  const watchedFields = watch([
    'pickupLat',
    'pickupLng',
    'dropoffLat',
    'dropoffLng',
    'tariffId',
  ]);

  // Auto-calculate price when coords + tariff are set
  const handleCalculatePrice = async () => {
    const [pickupLat, pickupLng, dropoffLat, dropoffLng, tariffId] = watchedFields;
    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng || !tariffId) return;

    setCalculatingPrice(true);
    try {
      const distanceKm = haversineDistanceKm(
        parseFloat(pickupLat),
        parseFloat(pickupLng),
        parseFloat(dropoffLat),
        parseFloat(dropoffLng),
      );
      const durationMin = Math.ceil(distanceKm * 2.5);

      const result = await calculatePrice({ tariffId, distanceKm, durationMin });
      setPriceEstimate(result);
    } catch (err) {
      console.error('Price calculation failed:', err);
    } finally {
      setCalculatingPrice(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      await createOrder({
        passengerPhone: data.passengerPhone,
        passengerName: data.passengerName,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat ? parseFloat(data.pickupLat) : 0,
        pickupLng: data.pickupLng ? parseFloat(data.pickupLng) : 0,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat ? parseFloat(data.dropoffLat) : 0,
        dropoffLng: data.dropoffLng ? parseFloat(data.dropoffLng) : 0,
        tariffId: data.tariffId,
        paymentMethod: data.paymentMethod,
        note: data.note,
      });

      setSubmitSuccess(true);
      reset();
      setPriceEstimate(null);
      onSuccess?.();
      // The inline banner above stays as the persistent record; the toast is
      // the immediate, non-blocking confirmation.
      toast({
        title: f.createdTitle,
        description: f.createdHint,
        variant: 'success',
      });
    } catch (err) {
      console.error('Create order failed:', err);
      setSubmitError(f.createFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tariffOptions = tariffs.map((tariff) => ({
    value: tariff.id,
    label: f.tariffOption(tariff.name, formatMoney(tariff.minPrice)),
  }));

  const paymentOptions = PAYMENT_VALUES.map((value) => ({
    value,
    label: paymentMethodLabels()[value],
  }));

  const canCalculate = watchedFields.every(Boolean);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {submitSuccess && (
        <div role="status" className="flex items-start gap-2.5 rounded-ds-sm border border-mint/40 bg-mint-tint px-3 py-2.5">
          <CheckCircle2 size={15} className="text-primary-text shrink-0 mt-0.5" aria-hidden />
          <p className="text-[13px] text-primary-text">
            {f.createdBanner}
          </p>
        </div>
      )}

      {submitError && (
        <div role="alert" className="flex items-start gap-2.5 rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2.5">
          <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" aria-hidden />
          <p className="text-[13px] text-danger-dark dark:text-danger-light">{submitError}</p>
        </div>
      )}

      {/* Passenger */}
      <div className="space-y-3">
        <SectionTitle icon={<User size={13} />}>{f.customer}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={f.phone}
            placeholder="+998 90 123 45 67"
            {...register('passengerPhone')}
            error={errors.passengerPhone?.message}
            leftElement={<Phone size={14} />}
          />
          <Input
            label={f.name}
            placeholder={f.namePlaceholder}
            {...register('passengerName')}
            error={errors.passengerName?.message}
          />
        </div>
      </div>

      {/* Pickup */}
      <div className="space-y-3">
        <SectionTitle
          icon={<span className="h-2 w-2 rounded-full bg-mint-deep ring-2 ring-mint/25" />}
        >
          {f.pickup}
        </SectionTitle>
        <Input
          label={f.address}
          placeholder={f.pickupPlaceholder}
          {...register('pickupAddress')}
          error={errors.pickupAddress?.message}
          leftElement={<MapPin size={14} />}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={f.lat}
            placeholder="40.0956"
            type="number"
            step="any"
            {...register('pickupLat')}
            error={errors.pickupLat?.message}
          />
          <Input
            label={f.lng}
            placeholder="70.9432"
            type="number"
            step="any"
            {...register('pickupLng')}
            error={errors.pickupLng?.message}
          />
        </div>
      </div>

      {/* Dropoff */}
      <div className="space-y-3">
        <SectionTitle icon={<MapPin size={13} className="text-danger" />}>
          {f.dropoff}
        </SectionTitle>
        <Input
          label={f.address}
          placeholder={f.dropoffPlaceholder}
          {...register('dropoffAddress')}
          error={errors.dropoffAddress?.message}
          leftElement={<MapPin size={14} />}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={f.lat}
            placeholder="40.1050"
            type="number"
            step="any"
            {...register('dropoffLat')}
            error={errors.dropoffLat?.message}
          />
          <Input
            label={f.lng}
            placeholder="70.9510"
            type="number"
            step="any"
            {...register('dropoffLng')}
            error={errors.dropoffLng?.message}
          />
        </div>
      </div>

      {/* Tariff & payment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label={f.tariff}
          options={tariffOptions}
          placeholder={
            tariffLoading ? m.common.loading : tariffError ? f.tariffsFailed : f.tariffPlaceholder
          }
          disabled={tariffLoading || tariffError}
          {...register('tariffId')}
          error={errors.tariffId?.message}
          hint={tariffError ? f.reloadHint : undefined}
        />
        <Select
          label={f.paymentMethod}
          options={paymentOptions}
          {...register('paymentMethod')}
          error={errors.paymentMethod?.message}
        />
      </div>

      <Textarea
        label={f.note}
        rows={3}
        placeholder={f.notePlaceholder}
        {...register('note')}
      />

      {/* Price estimate */}
      <div className="rounded-ds-md border border-line bg-surface-2/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle icon={<Calculator size={13} />}>{f.estimate}</SectionTitle>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCalculatePrice}
            isLoading={calculatingPrice}
            disabled={!canCalculate}
            title={!canCalculate ? f.calculateDisabled : undefined}
            leftIcon={<Calculator size={13} />}
          >
            {f.calculate}
          </Button>
        </div>

        {priceEstimate ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[11px] text-subtle">{f.price}</p>
              <p className="text-lg font-semibold text-ink leading-tight">
                <MoneyText value={priceEstimate.price} />
              </p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-subtle">{f.distance}</p>
              <p className="num text-lg font-semibold text-ink leading-tight">
                {formatDistanceKm(priceEstimate.distanceKm)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-subtle">{f.time}</p>
              <p className="num text-lg font-semibold text-ink leading-tight">
                {f.minutes(priceEstimate.durationMin)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-subtle">
            {f.estimateHint}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {f.submit}
        </Button>
      </div>
    </form>
  );
}
