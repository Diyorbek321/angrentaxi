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
import { Textarea } from '@/components/ui/Textarea';
import { PAYMENT_METHOD, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { formatDistanceKm, formatMoney } from '@/lib/format';

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

const schema = z.object({
  passengerPhone: z
    .string()
    .min(9, 'Telefon raqami kamida 9 ta raqamdan iborat boʻlsin')
    .regex(/^\+?[\d\s-]+$/, 'Telefon raqami notoʻgʻri'),
  passengerName: z.string().optional(),
  pickupAddress: z.string().min(3, 'Olib ketish manzili majburiy'),
  pickupLat: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)), 'Kenglik notoʻgʻri')
    .optional()
    .or(z.literal('')),
  pickupLng: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)), 'Uzunlik notoʻgʻri')
    .optional()
    .or(z.literal('')),
  dropoffAddress: z.string().min(3, 'Tashlab ketish manzili majburiy'),
  dropoffLat: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)), 'Kenglik notoʻgʻri')
    .optional()
    .or(z.literal('')),
  dropoffLng: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)), 'Uzunlik notoʻgʻri')
    .optional()
    .or(z.literal('')),
  tariffId: z.string().min(1, 'Tarifni tanlang'),
  paymentMethod: z.enum(PAYMENT_VALUES),
  note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateOrderFormProps {
  onSuccess?: () => void;
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle flex items-center gap-2">
      {icon}
      {children}
    </h3>
  );
}

export function CreateOrderForm({ onSuccess }: CreateOrderFormProps) {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [tariffLoading, setTariffLoading] = useState(true);
  const [tariffError, setTariffError] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState<CalculatePriceResponse | null>(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
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
    } catch (err) {
      console.error('Create order failed:', err);
      setSubmitError('Buyurtma yaratilmadi. Qaytadan urinib koʻring.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tariffOptions = tariffs.map((t) => ({
    value: t.id,
    label: `${t.name} — min ${formatMoney(t.minPrice)}`,
  }));

  const paymentOptions = PAYMENT_VALUES.map((value) => ({
    value,
    label: PAYMENT_METHOD_LABELS[value],
  }));

  const canCalculate = watchedFields.every(Boolean);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {submitSuccess && (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/40 bg-primary/[0.08] p-3.5">
          <CheckCircle2 size={16} className="text-primary-600 dark:text-primary-300 shrink-0 mt-0.5" />
          <p className="text-sm text-primary-700 dark:text-primary-300">
            Buyurtma yaratildi. Tizim avtomatik ravishda haydovchi qidirishni boshladi.
          </p>
        </div>
      )}

      {submitError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/[0.08] p-3.5">
          <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{submitError}</p>
        </div>
      )}

      {/* Passenger */}
      <div className="space-y-3">
        <SectionTitle icon={<User size={13} />}>Mijoz</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Telefon *"
            placeholder="+998 90 123 45 67"
            mono
            {...register('passengerPhone')}
            error={errors.passengerPhone?.message}
            leftElement={<Phone size={14} />}
          />
          <Input
            label="Ism (ixtiyoriy)"
            placeholder="Mijoz ismi"
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
          Olib ketish
        </SectionTitle>
        <Input
          label="Manzil *"
          placeholder="Olib ketish manzilini kiriting"
          {...register('pickupAddress')}
          error={errors.pickupAddress?.message}
          leftElement={<MapPin size={14} />}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Kenglik (lat)"
            placeholder="40.0956"
            type="number"
            step="any"
            mono
            {...register('pickupLat')}
            error={errors.pickupLat?.message}
          />
          <Input
            label="Uzunlik (lng)"
            placeholder="70.9432"
            type="number"
            step="any"
            mono
            {...register('pickupLng')}
            error={errors.pickupLng?.message}
          />
        </div>
      </div>

      {/* Dropoff */}
      <div className="space-y-3">
        <SectionTitle icon={<MapPin size={13} className="text-danger" />}>
          Tashlab ketish
        </SectionTitle>
        <Input
          label="Manzil *"
          placeholder="Tashlab ketish manzilini kiriting"
          {...register('dropoffAddress')}
          error={errors.dropoffAddress?.message}
          leftElement={<MapPin size={14} />}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Kenglik (lat)"
            placeholder="40.1050"
            type="number"
            step="any"
            mono
            {...register('dropoffLat')}
            error={errors.dropoffLat?.message}
          />
          <Input
            label="Uzunlik (lng)"
            placeholder="70.9510"
            type="number"
            step="any"
            mono
            {...register('dropoffLng')}
            error={errors.dropoffLng?.message}
          />
        </div>
      </div>

      {/* Tariff & payment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label="Tarif *"
          options={tariffOptions}
          placeholder={
            tariffLoading ? 'Yuklanmoqda…' : tariffError ? 'Tariflar yuklanmadi' : 'Tarifni tanlang'
          }
          disabled={tariffLoading || tariffError}
          {...register('tariffId')}
          error={errors.tariffId?.message}
          hint={tariffError ? 'Sahifani yangilab koʻring.' : undefined}
        />
        <Select
          label="Toʻlov turi *"
          options={paymentOptions}
          {...register('paymentMethod')}
          error={errors.paymentMethod?.message}
        />
      </div>

      <Textarea
        label="Izoh (ixtiyoriy)"
        rows={3}
        placeholder="Qoʻshimcha koʻrsatmalar…"
        {...register('note')}
      />

      {/* Price estimate */}
      <div className="rounded-xl border border-line bg-surface-2/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle icon={<Calculator size={13} />}>Taxminiy narx</SectionTitle>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCalculatePrice}
            isLoading={calculatingPrice}
            disabled={!canCalculate}
            title={!canCalculate ? 'Avval koordinatalar va tarifni kiriting' : undefined}
            leftIcon={<Calculator size={13} />}
          >
            Hisoblash
          </Button>
        </div>

        {priceEstimate ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[11px] text-subtle">Narx</p>
              <p className="font-mono text-lg font-bold text-primary-700 dark:text-primary-300 leading-tight">
                {formatMoney(priceEstimate.price)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-subtle">Masofa</p>
              <p className="font-mono text-lg font-bold text-ink leading-tight">
                {formatDistanceKm(priceEstimate.distanceKm)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-subtle">Vaqt</p>
              <p className="font-mono text-lg font-bold text-ink leading-tight">
                ~{priceEstimate.durationMin} daq
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-subtle">
            Koordinatalar va tarifni kiriting, soʻng «Hisoblash» tugmasini bosing.
          </p>
        )}
      </div>

      <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} className="w-full">
        Buyurtma yaratish
      </Button>
    </form>
  );
}
