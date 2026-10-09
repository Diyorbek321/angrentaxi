'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getTripOptionFees, updateTripOptionFees } from '@/lib/api';
import {
  TRIP_OPTIONS,
  TripOptionFees,
  TripOptionKey,
  changedFees,
  validateFee,
} from '@/lib/trip-option-fees';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

type Draft = Record<TripOptionKey, string>;

function toDraft(fees: TripOptionFees): Draft {
  return {
    child_seat: fees.child_seat ? String(fees.child_seat) : '',
    pet: fees.pet ? String(fees.pet) : '',
    air_conditioner: fees.air_conditioner ? String(fees.air_conditioner) : '',
    big_luggage: fees.big_luggage ? String(fees.big_luggage) : '',
  };
}

/**
 * Bola o'rindig'i, hayvon va h.k. uchun qo'shimcha haq. Tariflardan farqli
 * o'laroq admin tasdig'isiz darhol kuchga kiradi — faqat YANGI buyurtmalarga:
 * berilgan buyurtmaning haqi o'sha paytda muzlatilgan.
 */
export function TripOptionFeesCard() {
  const { toast } = useToast();
  const [fees, setFees] = useState<TripOptionFees | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft({}));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoadError(null);
    try {
      const data = await getTripOptionFees();
      setFees(data);
      setDraft(toDraft(data));
    } catch {
      setLoadError('Opsiya narxlarini yuklab boʻlmadi.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const errors = Object.fromEntries(
    TRIP_OPTIONS.map(({ key }) => [key, validateFee(draft[key])])
  ) as Record<TripOptionKey, string | null>;
  const hasErrors = Object.values(errors).some(Boolean);
  const changes = fees ? changedFees(fees, draft) : {};
  const isDirty = Object.keys(changes).length > 0;

  const save = async () => {
    if (hasErrors || !isDirty) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const updated = await updateTripOptionFees(changes);
      setFees(updated);
      setDraft(toDraft(updated));
      toast({
        title: 'Opsiya narxlari saqlandi',
        description: 'Yangi buyurtmalarga darhol qoʻllanadi.',
        variant: 'success',
      });
    } catch (err) {
      setSubmitError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Saqlab boʻlmadi'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Safar opsiyalari haqi</CardTitle>
          <p className="mt-0.5 text-xs text-muted">
            Narxga qoʻshiladi va chekda alohida qator boʻladi. Boʻsh — bepul.
          </p>
        </div>
      </CardHeader>

      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : fees === null ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true">
          {TRIP_OPTIONS.map(({ key }) => (
            <Skeleton key={key} className="h-16" />
          ))}
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="space-y-4"
        >
          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-ds-xs border border-danger/40 bg-danger-tint px-3.5 py-3"
            >
              <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-danger-deep dark:text-danger-light">{submitError}</p>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {TRIP_OPTIONS.map(({ key, label }) => (
              <Input
                key={key}
                label={`${label}, soʻm`}
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                mono
                placeholder="0"
                value={draft[key]}
                onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                error={errors[key] ?? undefined}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!isDirty || saving}
              onClick={() => setDraft(toDraft(fees))}
            >
              Bekor qilish
            </Button>
            <Button type="submit" size="sm" isLoading={saving} disabled={!isDirty || hasErrors}>
              Saqlash
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
