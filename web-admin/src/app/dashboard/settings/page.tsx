'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Percent, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonForm } from '@/components/ui/Skeleton';
import { settingsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function SettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rate, setRate] = useState('');
  /** Saqlangan qiymat — "o'zgardimi" (dirty) ni aniqlash uchun. */
  const [savedRate, setSavedRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const fetchCommission = () => {
    setIsLoading(true);
    settingsApi
      .getCommission()
      .then((res) => {
        const value = String(res.data.data.defaultCommissionRate);
        setRate(value);
        setSavedRate(value);
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
    fetchCommission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirty = rate !== savedRate;

  // Validatsiya maydonning O'ZIGA biriktiriladi — toast emas.
  const validate = (value: string): string | null => {
    const parsed = parseFloat(value);
    if (value.trim() === '') return 'Foizni kiriting';
    if (Number.isNaN(parsed)) return "Raqam bo'lishi kerak";
    if (parsed < 0 || parsed > 100) return "0 dan 100 gacha bo'lishi kerak";
    return null;
  };

  const handleChange = (value: string) => {
    setRate(value);
    if (fieldError) setFieldError(validate(value));
  };

  const handleSave = async () => {
    const invalid = validate(rate);
    if (invalid) {
      setFieldError(invalid);
      return;
    }
    setFieldError(null);
    setSaving(true);
    try {
      const value = parseFloat(rate);
      await settingsApi.setCommission(value);
      setSavedRate(String(value));
      setRate(String(value));
      toast({
        title: 'Saqlandi',
        description: `Standart komissiya foizi ${value}% qilib belgilandi.`,
        variant: 'success',
      });
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
        title="Sozlamalar"
        description="Platforma komissiyasi"
        icon={<Percent className="h-4 w-4" aria-hidden="true" />}
      />

      <div className="max-w-lg space-y-4">
        {showErrorBanner && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-4 py-3"
          >
            <p className="flex items-center gap-2 text-body text-danger-deep dark:text-danger-light">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error} — oxirgi yuklangan qiymat ko&apos;rsatilmoqda.
            </p>
            <Button variant="secondary" size="sm" onClick={fetchCommission}>
              Qayta urinish
            </Button>
          </div>
        )}

        {showFullError ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState message={error} onRetry={fetchCommission} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary-text" aria-hidden="true" />
                Platforma komissiyasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-body leading-relaxed text-muted">
                Har bir yakunlangan safardan haydovchi balansidan ushlab qolinadigan standart
                komissiya foizi. Alohida haydovchilar uchun (masalan, reklama tashigani uchun)
                haydovchi profilida boshqacha foiz belgilash mumkin.
              </p>
              {isLoading && !hasLoadedOnce ? (
                <SkeletonForm fields={1} />
              ) : (
                <Input
                  label="Standart komissiya foizi, %"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  mono
                  value={rate}
                  error={fieldError ?? undefined}
                  hint="0 dan 100 gacha. Masalan: 15 — safar summasining 15 foizi."
                  onChange={(e) => handleChange(e.target.value)}
                />
              )}

              {/* Saqlash affordansi + "saqlanmagan o'zgarish" ko'rsatkichi. */}
              <div className="flex flex-wrap items-center gap-3 border-t border-divider pt-4">
                <Button
                  onClick={handleSave}
                  isLoading={saving}
                  disabled={isLoading || !isDirty}
                  leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
                >
                  Saqlash
                </Button>
                {isDirty ? (
                  <span className="text-caption font-semibold text-override-dark dark:text-override-light">
                    • Saqlanmagan o&apos;zgarish bor
                  </span>
                ) : (
                  <span className="text-caption text-subtle">Barcha o&apos;zgarishlar saqlangan</span>
                )}
                {isDirty && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setRate(savedRate); setFieldError(null); }}
                  >
                    Bekor qilish
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
