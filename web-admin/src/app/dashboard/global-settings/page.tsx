'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Input,
  PageHeader,
  RetryBanner,
  SkeletonForm,
  Switch,
  useToast,
} from '@/components/ui';
import { settingsApi, type GlobalSettings } from '@/lib/api';
import { validateDeliverySettings } from '@/lib/delivery-settings';
import { IntercitySettingsCard } from '@/components/intercity/IntercitySettingsCard';
import { t } from '@/locales';

const EMPTY_FORM: GlobalSettings = {
  platformName: '',
  supportPhone: '',
  supportEmail: '',
  maintenanceMode: false,
  maxCashVendorOrder: 200000,
  deliveryFee: 7000,
  freeDeliveryFrom: 0,
  deliveryEtaMinMinutes: 30,
  deliveryEtaMaxMinutes: 50,
};

type FieldErrors = Partial<Record<keyof GlobalSettings, string>>;

export default function GlobalSettingsPage() {
  const c = t().common;
  const s = t().settings;
  const m = s.global;
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [form, setForm] = useState<GlobalSettings>(EMPTY_FORM);
  /** Serverdagi oxirgi holat — "o'zgardimi" (dirty) ni aniqlash uchun. */
  const [saved, setSaved] = useState<GlobalSettings>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const fetchSettings = () => {
    setIsLoading(true);
    settingsApi
      .getGlobal()
      .then((res) => {
        setForm(res.data.data);
        setSaved(res.data.data);
        setError(null);
        setHasLoadedOnce(true);
      })
      .catch(() => {
        setError(s.loadFailed);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirty = (Object.keys(form) as (keyof GlobalSettings)[]).some((k) => form[k] !== saved[k]);

  // Validatsiya har bir maydonning O'ZIGA biriktiriladi — toast emas.
  const validate = (values: GlobalSettings): FieldErrors => {
    const errors: FieldErrors = {};
    if (!values.platformName.trim()) errors.platformName = m.errPlatformName;
    if (values.supportPhone.trim() && !/^\+?\d[\d\s-]{7,}$/.test(values.supportPhone.trim())) {
      errors.supportPhone = m.errPhone;
    }
    if (values.supportEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.supportEmail.trim())) {
      errors.supportEmail = m.errEmail;
    }
    if (!Number.isFinite(values.maxCashVendorOrder) || values.maxCashVendorOrder < 0) {
      errors.maxCashVendorOrder = m.errMaxCash;
    }
    return { ...errors, ...validateDeliverySettings(values) };
  };

  const update = <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    // Re-validate while typing once an error is showing (no side effect inside
    // a state updater — that runs twice in StrictMode).
    if (fieldErrors[key]) setFieldErrors(validate(next));
  };

  const handleSave = async () => {
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const res = await settingsApi.updateGlobal(form);
      setForm(res.data.data);
      setSaved(res.data.data);
      toast({ title: s.saved, description: m.savedDesc, variant: 'success' });
    } catch {
      toast({ title: c.error, description: c.saveError, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const showFullError = error && !isLoading && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && hasLoadedOnce;

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={m.title}
        description={m.description}
      />

      <div className="max-w-2xl space-y-4">
        {showErrorBanner && (
          <RetryBanner message={error} onRetry={fetchSettings} keepsLastData retrying={isLoading} />
        )}

        {showFullError ? (
          <Card padding="none">
            <ErrorState message={error} onRetry={fetchSettings} />
          </Card>
        ) : isLoading && !hasLoadedOnce ? (
          <Card padding="lg">
            <SkeletonForm fields={4} />
          </Card>
        ) : (
          <div className="space-y-4">
            <Card padding="none">
              <CardHeader title={m.contactTitle} divider />
              <CardBody className="space-y-4 pt-4">
                <Input
                  label={m.platformName}
                  value={form.platformName}
                  error={fieldErrors.platformName}
                  hint={m.platformNameHint}
                  onChange={(e) => update('platformName', e.target.value)}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label={m.supportPhone}
                    type="tel"
                    className="num"
                    placeholder="+998901234567"
                    value={form.supportPhone}
                    error={fieldErrors.supportPhone}
                    onChange={(e) => update('supportPhone', e.target.value)}
                  />
                  <Input
                    label={m.supportEmail}
                    type="email"
                    placeholder="support@angrentaxi.uz"
                    value={form.supportEmail}
                    error={fieldErrors.supportEmail}
                    onChange={(e) => update('supportEmail', e.target.value)}
                  />
                </div>
              </CardBody>
            </Card>

            {/* Food/market: the courier buys the goods with their own cash
                (backend delivery/vendor-cash.ts) — cash only up to this sum. */}
            <Card padding="none">
              <CardHeader title={m.cashTitle} divider />
              <CardBody className="pt-4">
                <Input
                  label={m.maxCash}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={String(form.maxCashVendorOrder)}
                  error={fieldErrors.maxCashVendorOrder}
                  hint={m.maxCashHint}
                  onChange={(e) => update('maxCashVendorOrder', Number(e.target.value))}
                  wrapperClassName="max-w-xs"
                />
              </CardBody>
            </Card>

            {/* Mijoz ilovasi: "Yetkazish 7 000 soʻm · 30–50 daq · 100 000 soʻmdan bepul".
                Bepul chegara aksiyadan keyingi tovar summasiga qaraydi (backend
                settings/delivery-pricing.ts). */}
            <Card padding="none">
              <CardHeader title={m.deliveryTitle} divider />
              <CardBody className="space-y-4 pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label={m.deliveryFee}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={500}
                    value={String(form.deliveryFee)}
                    error={fieldErrors.deliveryFee}
                    onChange={(e) => update('deliveryFee', Number(e.target.value))}
                  />
                  <Input
                    label={m.freeDeliveryFrom}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    value={String(form.freeDeliveryFrom)}
                    error={fieldErrors.freeDeliveryFrom}
                    hint={m.freeDeliveryHint}
                    onChange={(e) => update('freeDeliveryFrom', Number(e.target.value))}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label={m.etaMin}
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={240}
                    step={5}
                    value={String(form.deliveryEtaMinMinutes)}
                    error={fieldErrors.deliveryEtaMinMinutes}
                    onChange={(e) => update('deliveryEtaMinMinutes', Number(e.target.value))}
                  />
                  <Input
                    label={m.etaMax}
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={240}
                    step={5}
                    value={String(form.deliveryEtaMaxMinutes)}
                    error={fieldErrors.deliveryEtaMaxMinutes}
                    onChange={(e) => update('deliveryEtaMaxMinutes', Number(e.target.value))}
                  />
                </div>
              </CardBody>
            </Card>

            {/* O'z endpointi va saqlash tugmasi bor — umumiy formaning "dirty" holatiga kirmaydi. */}
            <IntercitySettingsCard />

            <Card padding="none">
              <CardHeader title={m.maintenanceTitle} divider />
              <CardBody className="space-y-3 pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{m.maintenanceMode}</p>
                    <p className="mt-0.5 text-xs text-muted">{m.maintenanceHint}</p>
                  </div>
                  <Switch
                    checked={form.maintenanceMode}
                    onCheckedChange={(v) => update('maintenanceMode', v)}
                    tone="danger"
                    aria-label={m.maintenanceAria}
                  />
                </div>
                {form.maintenanceMode && (
                  <div className="flex items-start gap-2 rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2">
                    <AlertTriangle
                      size={15}
                      className="mt-px shrink-0 text-danger-dark dark:text-danger-light"
                      aria-hidden="true"
                    />
                    <p className="text-xs leading-relaxed text-danger-dark dark:text-danger-light">
                      {m.maintenanceWarning}
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-xs text-muted" aria-live="polite">
                {isDirty ? s.dirty : s.clean}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={!isDirty || saving}
                  onClick={() => {
                    setForm(saved);
                    setFieldErrors({});
                  }}
                >
                  {c.cancel}
                </Button>
                <Button
                  onClick={handleSave}
                  isLoading={saving}
                  disabled={!isDirty}
                  leftIcon={<Save size={14} aria-hidden="true" />}
                >
                  {c.save}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
