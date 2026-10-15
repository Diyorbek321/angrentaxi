'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  ErrorState,
  Input,
  PageHeader,
  RetryBanner,
  SkeletonForm,
  useToast,
} from '@/components/ui';
import { settingsApi } from '@/lib/api';

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
        setError('Sozlamalarni yuklab boʻlmadi.');
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
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title="Sozlamalar" description="Platforma komissiyasi" />

      <div className="max-w-xl space-y-4">
        {showErrorBanner && (
          <RetryBanner message={error} onRetry={fetchCommission} keepsLastData retrying={isLoading} />
        )}

        {showFullError ? (
          <Card padding="none">
            <ErrorState message={error} onRetry={fetchCommission} />
          </Card>
        ) : (
          <Card padding="none">
            <CardHeader
              title="Platforma komissiyasi"
              description="Har bir yakunlangan safardan haydovchi balansidan ushlab qolinadigan standart foiz. Alohida haydovchi uchun profilida boshqa foiz belgilash mumkin."
              divider
            />
            <CardBody className="pt-4">
              {isLoading && !hasLoadedOnce ? (
                <SkeletonForm fields={1} />
              ) : (
                <Input
                  label="Standart komissiya foizi, %"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={rate}
                  error={fieldError ?? undefined}
                  hint="0 dan 100 gacha. Masalan: 15 — safar summasining 15 foizi."
                  onChange={(e) => handleChange(e.target.value)}
                  wrapperClassName="max-w-xs"
                />
              )}
            </CardBody>
            <CardFooter className="justify-between">
              <span className="text-xs text-muted" aria-live="polite">
                {isDirty ? 'Saqlanmagan oʻzgarish bor' : 'Barcha oʻzgarishlar saqlangan'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={!isDirty || saving}
                  onClick={() => {
                    setRate(savedRate);
                    setFieldError(null);
                  }}
                >
                  Bekor qilish
                </Button>
                <Button
                  onClick={handleSave}
                  isLoading={saving}
                  disabled={isLoading || !isDirty}
                  leftIcon={<Save size={14} aria-hidden="true" />}
                >
                  Saqlash
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
