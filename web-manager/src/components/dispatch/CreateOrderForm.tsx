'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calculator, MapPin, Phone, User } from 'lucide-react';
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
import { PAYMENT_METHOD } from '@/lib/constants';

const PAYMENT_VALUES = [
  PAYMENT_METHOD.CASH,
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.WALLET,
] as const;

const schema = z.object({
  passengerPhone: z
    .string()
    .min(9, 'Phone must be at least 9 digits')
    .regex(/^\+?[\d\s-]+$/, 'Invalid phone number'),
  passengerName: z.string().optional(),
  pickupAddress: z.string().min(3, 'Pickup address is required'),
  pickupLat: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)), 'Invalid latitude')
    .optional()
    .or(z.literal('')),
  pickupLng: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)), 'Invalid longitude')
    .optional()
    .or(z.literal('')),
  dropoffAddress: z.string().min(3, 'Dropoff address is required'),
  dropoffLat: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)), 'Invalid latitude')
    .optional()
    .or(z.literal('')),
  dropoffLng: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)), 'Invalid longitude')
    .optional()
    .or(z.literal('')),
  tariffId: z.string().min(1, 'Please select a tariff'),
  paymentMethod: z.enum(PAYMENT_VALUES),
  note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateOrderFormProps {
  onSuccess?: () => void;
}

export function CreateOrderForm({ onSuccess }: CreateOrderFormProps) {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [tariffLoading, setTariffLoading] = useState(true);
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
      .catch(() => console.error('Failed to load tariffs'))
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
      const result = await calculatePrice({
        pickupCoordinates: {
          lat: parseFloat(pickupLat),
          lng: parseFloat(pickupLng),
        },
        dropoffCoordinates: {
          lat: parseFloat(dropoffLat),
          lng: parseFloat(dropoffLng),
        },
        tariffId,
      });
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
        pickupCoordinates: {
          lat: data.pickupLat ? parseFloat(data.pickupLat) : 0,
          lng: data.pickupLng ? parseFloat(data.pickupLng) : 0,
        },
        dropoffAddress: data.dropoffAddress,
        dropoffCoordinates: {
          lat: data.dropoffLat ? parseFloat(data.dropoffLat) : 0,
          lng: data.dropoffLng ? parseFloat(data.dropoffLng) : 0,
        },
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
      setSubmitError('Failed to create order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tariffOptions = tariffs.map((t) => ({
    value: t.id,
    label: `${t.name} — min ${t.minFare} ${t.currency}`,
  }));

  const paymentOptions = [
    { value: PAYMENT_METHOD.CASH, label: 'Cash' },
    { value: PAYMENT_METHOD.CARD, label: 'Card' },
    { value: PAYMENT_METHOD.WALLET, label: 'Wallet' },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Success banner */}
      {submitSuccess && (
        <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-lg p-4 text-emerald-400 text-sm">
          Order created successfully!
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-4 text-red-400 text-sm">
          {submitError}
        </div>
      )}

      {/* Passenger */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <User size={15} className="text-gray-500" />
          Passenger
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Phone *"
            placeholder="+998 90 123 45 67"
            {...register('passengerPhone')}
            error={errors.passengerPhone?.message}
            leftElement={<Phone size={14} />}
          />
          <Input
            label="Name (optional)"
            placeholder="Passenger name"
            {...register('passengerName')}
            error={errors.passengerName?.message}
          />
        </div>
      </div>

      {/* Pickup */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent-500" />
          Pickup
        </h3>
        <Input
          label="Pickup Address *"
          placeholder="Enter pickup address"
          {...register('pickupAddress')}
          error={errors.pickupAddress?.message}
          leftElement={<MapPin size={14} />}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Latitude"
            placeholder="41.2995"
            type="number"
            step="any"
            {...register('pickupLat')}
            error={errors.pickupLat?.message}
          />
          <Input
            label="Longitude"
            placeholder="69.2401"
            type="number"
            step="any"
            {...register('pickupLng')}
            error={errors.pickupLng?.message}
          />
        </div>
      </div>

      {/* Dropoff */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <MapPin size={15} className="text-red-400" />
          Dropoff
        </h3>
        <Input
          label="Dropoff Address *"
          placeholder="Enter dropoff address"
          {...register('dropoffAddress')}
          error={errors.dropoffAddress?.message}
          leftElement={<MapPin size={14} />}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Latitude"
            placeholder="41.3111"
            type="number"
            step="any"
            {...register('dropoffLat')}
            error={errors.dropoffLat?.message}
          />
          <Input
            label="Longitude"
            placeholder="69.2797"
            type="number"
            step="any"
            {...register('dropoffLng')}
            error={errors.dropoffLng?.message}
          />
        </div>
      </div>

      {/* Tariff & Payment */}
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Tariff *"
          options={tariffOptions}
          placeholder={tariffLoading ? 'Loading...' : 'Select tariff'}
          disabled={tariffLoading}
          {...register('tariffId')}
          error={errors.tariffId?.message}
        />
        <Select
          label="Payment Method *"
          options={paymentOptions}
          {...register('paymentMethod')}
          error={errors.paymentMethod?.message}
        />
      </div>

      {/* Note */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-300">Note (optional)</label>
        <textarea
          className="w-full bg-gray-800 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent hover:border-gray-500 transition-colors resize-none"
          rows={3}
          placeholder="Any special instructions..."
          {...register('note')}
        />
      </div>

      {/* Price calculator */}
      <div className="bg-gray-700/40 border border-gray-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Calculator size={15} className="text-gray-500" />
            Price Estimate
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCalculatePrice}
            isLoading={calculatingPrice}
            leftIcon={<Calculator size={13} />}
          >
            Calculate
          </Button>
        </div>

        {priceEstimate ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-500">Price</p>
              <p className="text-accent-500 font-semibold text-lg">
                {priceEstimate.estimatedPrice.toLocaleString()}
              </p>
              <p className="text-xs text-gray-600">{priceEstimate.currency}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Distance</p>
              <p className="text-gray-200 font-semibold">
                {(priceEstimate.estimatedDistance / 1000).toFixed(1)} km
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Duration</p>
              <p className="text-gray-200 font-semibold">
                ~{Math.round(priceEstimate.estimatedDuration / 60)} min
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-600 text-xs">
            Fill in coordinates and tariff, then click Calculate
          </p>
        )}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isSubmitting}
        className="w-full"
      >
        Create Order
      </Button>
    </form>
  );
}
