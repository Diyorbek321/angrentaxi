'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Save, Settings, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonForm } from '@/components/ui/Skeleton';
import { settingsApi, GlobalSettings } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const EMPTY_FORM: GlobalSettings = {
  platformName: '',
  supportPhone: '',
  supportEmail: '',
  maintenanceMode: false,
  maxCashVendorOrder: 200000,
};

type FieldErrors = Partial<Record<keyof GlobalSettings, string>>;

export default function GlobalSettingsPage() {
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
        const message = 'Sozlamalarni yuklashda xatolik';
        setError(message);
        toast({ title: 'Xatolik', description: message, variant: 'error' });
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
    if (!values.platformName.trim()) errors.platformName = 'Platforma nomini kiriting';
    if (values.supportPhone.trim() && !/^\+?\d[\d\s-]{7,}$/.test(values.supportPhone.trim())) {
      errors.supportPhone = "Noto'g'ri telefon format (+998XXXXXXXXX)";
    }
    if (values.supportEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.supportEmail.trim())) {
      errors.supportEmail = "Noto'g'ri email manzil";
    }
    if (!Number.isFinite(values.maxCashVendorOrder) || values.maxCashVendorOrder < 0) {
      errors.maxCashVendorOrder = "Musbat summa kiriting (0 — cheklanmagan)";
    }
    return errors;
  };

  const update = <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Xato ko'rsatilgan bo'lsa, yozayotganda darhol qayta tekshiriladi.
      if (fieldErrors[key]) setFieldErrors(validate(next));
      return next;
    });
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
      toast({ title: 'Saqlandi', description: 'Umumiy sozlamalar yangilandi.', variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', description: 'Saqlashda xatolik', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const showFullError = error && !isLoading && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && hasLoadedOnce;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Umumiy sozlamalar"
        description="Platforma nomi, aloqa va texnik profilaktika rejimi"
        icon={<Settings className="h-4 w-4" aria-hidden="true" />}
      />

      <div className="max-w-2xl space-y-4">
        {showErrorBanner && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-4 py-3"
          >
            <p className="flex items-center gap-2 text-body text-danger-deep dark:text-danger-light">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error} — oxirgi yuklangan qiymatlar ko&apos;rsatilmoqda.
            </p>
            <Button variant="secondary" size="sm" onClick={fetchSettings}>
              Qayta urinish
            </Button>
          </div>
        )}

        {showFullError ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState message={error} onRetry={fetchSettings} />
            </CardContent>
          </Card>
        ) : isLoading && !hasLoadedOnce ? (
          <Card>
            <CardContent className="pt-5">
              <SkeletonForm fields={4} />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Bo'lim 1 — brend va aloqa. */}
            <Card>
              <CardHeader>
                <CardTitle>Platforma va aloqa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Platforma nomi"
                  value={form.platformName}
                  error={fieldErrors.platformName}
                  hint="Ilova va SMS xabarlarida ko'rinadigan nom."
                  onChange={(e) => update('platformName', e.target.value)}
                />
                <Input
                  label="Qo'llab-quvvatlash telefoni"
                  mono
                  placeholder="+998901234567"
                  value={form.supportPhone}
                  error={fieldErrors.supportPhone}
                  onChange={(e) => update('supportPhone', e.target.value)}
                />
                <Input
                  label="Qo'llab-quvvatlash emaili"
                  type="email"
                  placeholder="support@angrentaxi.uz"
                  value={form.supportEmail}
                  error={fieldErrors.supportEmail}
                  onChange={(e) => update('supportEmail', e.target.value)}
                />
              </CardContent>
            </Card>

            {/* Ovqat/market: kuryer tovarni do'kondan o'z pulidan sotib oladi
                (backend delivery/vendor-cash.ts) — naqd shu summagacha. */}
            <Card>
              <CardHeader>
                <CardTitle>Ovqat va market: naqd toʻlov</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  label="Naqd buyurtma chegarasi, soʻm"
                  type="number"
                  inputMode="numeric"
                  mono
                  min={0}
                  step={1000}
                  value={String(form.maxCashVendorOrder)}
                  error={fieldErrors.maxCashVendorOrder}
                  hint="Kuryer tovarni doʻkondan oʻz pulidan sotib oladi. Bundan katta buyurtma faqat karta bilan. 0 — cheklanmagan."
                  onChange={(e) => update('maxCashVendorOrder', Number(e.target.value))}
                />
              </CardContent>
            </Card>

            {/* Bo'lim 2 — texnik profilaktika. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-muted" aria-hidden="true" />
                  Texnik profilaktika rejimi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-ds-md bg-surface-2 px-4 py-3">
                  <div>
                    <p className="text-body font-medium text-ink">Profilaktika rejimi</p>
                    <p className="mt-0.5 text-caption text-muted">
                      Faqat belgi sifatida saqlanadi — hozircha haqiqiy so&apos;rovlarni bloklamaydi.
                    </p>
                  </div>
                  <Switch
                    checked={form.maintenanceMode}
                    onCheckedChange={(v) => update('maintenanceMode', v)}
                    tone="danger"
                    aria-label="Texnik profilaktika rejimi"
                  />
                </div>
                {form.maintenanceMode && (
                  <div className="flex items-start gap-2 rounded-ds-md border border-danger/30 bg-danger-tint px-3 py-2.5">
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-danger-deep dark:text-danger-light"
                      aria-hidden="true"
                    />
                    <p className="text-caption leading-relaxed text-danger-deep dark:text-danger-light">
                      Belgi yoqildi, lekin bu real trafikni bloklamaydi — bu qadam ataylab
                      qo&apos;shilmagan (jonli tizimga ta&apos;sir qiladigan o&apos;zgarish, alohida
                      tasdiq talab qiladi).
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Yagona, aniq saqlash affordansi + dirty ko'rsatkichi. */}
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <Button
                onClick={handleSave}
                isLoading={saving}
                disabled={!isDirty}
                leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
              >
                Saqlash
              </Button>
              {isDirty ? (
                <>
                  <span className="text-caption font-semibold text-override-dark dark:text-override-light">
                    • Saqlanmagan o&apos;zgarish bor
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setForm(saved); setFieldErrors({}); }}
                  >
                    O&apos;zgarishlarni bekor qilish
                  </Button>
                </>
              ) : (
                <span className="text-caption text-subtle">Barcha o&apos;zgarishlar saqlangan</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
