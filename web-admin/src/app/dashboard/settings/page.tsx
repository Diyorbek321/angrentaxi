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
import { t } from '@/locales';

export default function SettingsPage() {
  const c = t().common;
  const s = t().settings;
  const m = s.commission;
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
        setError(s.loadFailed);
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
    if (value.trim() === '') return m.errRequired;
    if (Number.isNaN(parsed)) return m.errNumber;
    if (parsed < 0 || parsed > 100) return m.errRange;
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
        title: s.saved,
        description: m.savedDesc(value),
        variant: 'success',
      });
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
      <PageHeader title={m.pageTitle} description={m.title} />

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
              title={m.title}
              description={m.description}
              divider
            />
            <CardBody className="pt-4">
              {isLoading && !hasLoadedOnce ? (
                <SkeletonForm fields={1} />
              ) : (
                <Input
                  label={m.rateLabel}
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={rate}
                  error={fieldError ?? undefined}
                  hint={m.rateHint}
                  onChange={(e) => handleChange(e.target.value)}
                  wrapperClassName="max-w-xs"
                />
              )}
            </CardBody>
            <CardFooter className="justify-between">
              <span className="text-xs text-muted" aria-live="polite">
                {isDirty ? s.dirty : s.clean}
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
                  {c.cancel}
                </Button>
                <Button
                  onClick={handleSave}
                  isLoading={saving}
                  disabled={isLoading || !isDirty}
                  leftIcon={<Save size={14} aria-hidden="true" />}
                >
                  {c.save}
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
