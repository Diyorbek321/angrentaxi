'use client';

import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  Input,
  SkeletonForm,
  Switch,
  useToast,
} from '@/components/ui';
import { apiErrorMessage, apiErrorTitle } from '@/lib/api-error';
import { intercityApi } from '@/lib/intercity-api';
import { validateIntercitySettings, type FormErrors, type IntercitySettings } from '@/lib/intercity';
import { t } from '@/locales';

type NumericKey = Exclude<keyof IntercitySettings, 'intercityEnabled'>;

const numericFields = (): readonly { key: NumericKey; label: string; hint: string; max: number }[] => {
  const m = t().intercity.settings;
  return [
    { key: 'intercityFreeCancelMinutes', label: m.freeCancelLabel, hint: m.freeCancelHint, max: 1440 },
    { key: 'intercityMaxSeatsPerBooking', label: m.maxSeatsLabel, hint: m.maxSeatsHint, max: 8 },
    { key: 'intercityMinLeadMinutes', label: m.minLeadLabel, hint: m.minLeadHint, max: 720 },
    { key: 'intercityMaxAheadDays', label: m.maxAheadLabel, hint: m.maxAheadHint, max: 30 },
    { key: 'intercityMaxDetourMinutes', label: m.detourLabel, hint: m.detourHint, max: 120 },
  ];
};

/**
 * "Shaharlararo" sozlamalari — alohida endpoint (`/settings/intercity`), shuning
 * uchun umumiy forma bilan emas, o'z saqlash tugmasi bilan.
 */
export function IntercitySettingsCard() {
  const m = t();
  const sm = m.intercity.settings;
  const { toast } = useToast();
  const [form, setForm] = useState<IntercitySettings | null>(null);
  const [saved, setSaved] = useState<IntercitySettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors<IntercitySettings>>({});
  const [saving, setSaving] = useState(false);
  const [confirmEnable, setConfirmEnable] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await intercityApi.getSettings();
      setForm(res.data.data);
      setSaved(res.data.data);
    } catch {
      setLoadError(t().intercity.settings.loadError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError && !form) {
    return (
      <Card padding="none">
        <ErrorState message={loadError} onRetry={load} />
      </Card>
    );
  }
  if (!form || !saved) {
    return (
      <Card padding="lg">
        <SkeletonForm fields={3} />
      </Card>
    );
  }

  const isDirty = (Object.keys(form) as (keyof IntercitySettings)[]).some((k) => form[k] !== saved[k]);
  // Yoqish — jonli tizimga ta'sir: ilovalarda yangi xizmat paydo bo'ladi. Tasdiq so'raladi.
  const enabling = form.intercityEnabled && !saved.intercityEnabled;

  const update = <K extends keyof IntercitySettings>(key: K, value: IntercitySettings[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (errors[key]) setErrors(validateIntercitySettings(next));
  };

  const persist = async () => {
    setSaving(true);
    try {
      const res = await intercityApi.updateSettings(form);
      setForm(res.data.data);
      setSaved(res.data.data);
      toast({ title: sm.saved, description: sm.savedDescription, variant: 'success' });
    } catch (err) {
      toast({
        title: apiErrorTitle(err, m.common.error),
        description: apiErrorMessage(err, m.common.saveError),
        variant: 'error',
      });
    } finally {
      setSaving(false);
      setConfirmEnable(false);
    }
  };

  const handleSave = () => {
    const found = validateIntercitySettings(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (enabling) {
      setConfirmEnable(true);
      return;
    }
    void persist();
  };

  return (
    <Card padding="none">
      <CardHeader title={sm.title} divider />
      <CardBody className="space-y-4 pt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{sm.enabledTitle}</p>
            <p className="mt-0.5 text-xs text-muted">
              {sm.enabledHint}
            </p>
          </div>
          <Switch
            checked={form.intercityEnabled}
            onCheckedChange={(v) => update('intercityEnabled', v)}
            aria-label={sm.enableAria}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {numericFields().map((field) => (
            <Input
              key={field.key}
              label={field.label}
              type="number"
              inputMode="numeric"
              min={0}
              max={field.max}
              step={1}
              value={String(form[field.key])}
              error={errors[field.key]}
              hint={field.hint}
              onChange={(e) => update(field.key, Number(e.target.value))}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-xs text-muted" aria-live="polite">
            {isDirty ? sm.dirty : sm.clean}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={!isDirty || saving}
              onClick={() => {
                setForm(saved);
                setErrors({});
              }}
            >
              {m.common.cancel}
            </Button>
            <Button
              onClick={handleSave}
              isLoading={saving}
              disabled={!isDirty}
              leftIcon={<Save size={14} aria-hidden="true" />}
            >
              {m.common.save}
            </Button>
          </div>
        </div>
      </CardBody>

      <ConfirmDialog
        isOpen={confirmEnable}
        onClose={() => setConfirmEnable(false)}
        onConfirm={persist}
        isPending={saving}
        tone="default"
        title={sm.confirmTitle}
        confirmLabel={sm.confirmLabel}
        description={sm.confirmDescription}
      />
    </Card>
  );
}
