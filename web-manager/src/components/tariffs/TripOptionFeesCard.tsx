'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getTripOptionFees, updateTripOptionFees } from '@/lib/api';
import {
  tripOptions,
  TripOptionFees,
  TripOptionKey,
  changedFees,
  validateFee,
} from '@/lib/trip-option-fees';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { t } from '@/locales';

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
  const m = t();
  const fm = m.ops.tripOptionFees;
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
      setLoadError(t().ops.tripOptionFees.loadFailed);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const errors = Object.fromEntries(
    tripOptions().map(({ key }) => [key, validateFee(draft[key])])
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
        title: fm.saved,
        description: fm.savedDescription,
        variant: 'success',
      });
    } catch (err) {
      setSubmitError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          fm.saveFailed
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="none">
      <CardHeader
        title={fm.title}
        description={fm.description}
      />
      <CardBody>

      {loadError ? (
        <ErrorState compact title={loadError} onRetry={load} />
      ) : fees === null ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true">
          {tripOptions().map(({ key }) => (
            <Skeleton key={key} className="h-[52px]" />
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
              className="flex items-start gap-2.5 rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2"
            >
              <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" aria-hidden />
              <p className="text-[13px] text-danger-dark dark:text-danger-light">{submitError}</p>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tripOptions().map(({ key, label }) => (
              <Input
                key={key}
                label={fm.fieldLabel(label)}
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                placeholder="0"
                value={draft[key]}
                onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                error={errors[key] ?? undefined}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!isDirty || saving}
              onClick={() => setDraft(toDraft(fees))}
            >
              {m.common.cancel}
            </Button>
            <Button type="submit" size="sm" isLoading={saving} disabled={!isDirty || hasErrors}>
              {m.common.save}
            </Button>
          </div>
        </form>
      )}
      </CardBody>
    </Card>
  );
}
