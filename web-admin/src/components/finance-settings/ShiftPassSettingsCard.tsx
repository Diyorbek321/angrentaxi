'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { useResource } from '@/hooks/useResource';
import { financeSettingsApi, type ShiftPassSettings } from '@/lib/compliance-api';
import { apiErrorMessage } from '@/lib/compliance';
import { serviceTypeLabels, SHIFT_SERVICE_TYPES } from '@/lib/compliance-labels';
import { formatMoney } from '@/lib/format';
import { t } from '@/locales';

interface Form {
  enabled: boolean;
  price: string;
  hours: string;
  serviceTypes: string[];
}

type Errors = Partial<Record<'price' | 'hours' | 'serviceTypes', string>>;

const toForm = (s: ShiftPassSettings): Form => ({
  enabled: s.shiftPassEnabled,
  price: String(s.shiftPassPrice),
  hours: String(s.shiftPassDurationHours),
  serviceTypes: [...s.shiftPassServiceTypes],
});

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

function validate(f: Form): Errors {
  const v = t().finance.shiftPass;
  const errors: Errors = {};
  const price = Number(f.price);
  const hours = Number(f.hours);
  if (!Number.isInteger(price) || price < 1000 || price > 10_000_000) {
    errors.price = v.priceRange;
  }
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) errors.hours = v.hoursRange;
  if (f.serviceTypes.length === 0) errors.serviceTypes = v.serviceTypesRequired;
  return errors;
}

/** Smena (kunlik obuna) — LEGAL-COMPLIANCE §8. */
export function ShiftPassSettingsCard() {
  const m = t();
  const f = m.finance.shiftPass;
  const labels = serviceTypeLabels();
  const { toast } = useToast();
  const res = useResource(
    () => financeSettingsApi.getShiftPass().then((r) => r.data.data),
    f.loadError
  );
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (res.data) setForm(toForm(res.data));
  }, [res.data]);

  const saved = res.data ? toForm(res.data) : null;
  const dirty =
    !!form &&
    !!saved &&
    (form.enabled !== saved.enabled ||
      form.price !== saved.price ||
      form.hours !== saved.hours ||
      !sameSet(form.serviceTypes, saved.serviceTypes));

  const update = (patch: Partial<Form>) => {
    if (!form) return;
    const next = { ...form, ...patch };
    setForm(next);
    if (Object.keys(errors).length > 0) setErrors(validate(next));
  };

  const save = async () => {
    if (!form) return;
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      const r = await financeSettingsApi.updateShiftPass({
        shiftPassEnabled: form.enabled,
        shiftPassPrice: Number(form.price),
        shiftPassDurationHours: Number(form.hours),
        shiftPassServiceTypes: form.serviceTypes,
      });
      res.setData(r.data.data);
      toast({ title: m.finance.saved, description: f.savedDesc, variant: 'success' });
    } catch (err) {
      toast({ title: m.common.error, description: apiErrorMessage(err, m.common.saveError), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleType = (type: string, on: boolean) => {
    if (!form) return;
    update({
      serviceTypes: on ? [...form.serviceTypes, type] : form.serviceTypes.filter((t) => t !== type),
    });
  };

  return (
    <SettingsSection
      title={f.title}
      description={f.description}
      badge={
        res.data ? (
          <Badge variant={res.data.shiftPassEnabled ? 'success' : 'neutral'} dot={res.data.shiftPassEnabled}>
            {res.data.shiftPassEnabled ? m.finance.enabled : m.finance.disabled}
          </Badge>
        ) : null
      }
      loading={res.loading}
      error={res.error}
      hasLoaded={res.hasLoaded && !!form}
      onRetry={res.reload}
      dirty={dirty}
      saving={saving}
      onReset={() => {
        if (saved) setForm(saved);
        setErrors({});
      }}
      onSave={save}
    >
      {form && (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-ink">{f.sales}</p>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => update({ enabled: v })}
              aria-label={f.sales}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={f.priceLabel}
              type="number"
              inputMode="numeric"
              min={1000}
              step={1000}
              value={form.price}
              error={errors.price}
              hint={!errors.price && Number(form.price) > 0 ? formatMoney(Number(form.price)) : undefined}
              onChange={(e) => update({ price: e.target.value })}
            />
            <Input
              label={f.hoursLabel}
              type="number"
              inputMode="numeric"
              min={1}
              max={168}
              value={form.hours}
              error={errors.hours}
              onChange={(e) => update({ hours: e.target.value })}
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink">{f.servicesLegend}</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {SHIFT_SERVICE_TYPES.map((type) => (
                <Checkbox
                  key={type}
                  label={labels[type]}
                  checked={form.serviceTypes.includes(type)}
                  onCheckedChange={(on) => toggleType(type, on)}
                />
              ))}
            </div>
            {errors.serviceTypes && (
              <p className="mt-1.5 text-xs text-danger-dark dark:text-danger-light" role="alert">
                {errors.serviceTypes}
              </p>
            )}
          </fieldset>
        </>
      )}
    </SettingsSection>
  );
}
