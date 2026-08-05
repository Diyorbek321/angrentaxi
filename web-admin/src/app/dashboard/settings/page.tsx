'use client';

import { useEffect, useState } from 'react';
import { Percent } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);

  const fetchCommission = () => {
    setIsLoading(true);
    settingsApi
      .getCommission()
      .then((res) => {
        setRate(String(res.data.data.defaultCommissionRate));
        setError(null);
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

  const handleSave = async () => {
    const value = parseFloat(rate);
    if (isNaN(value) || value < 0 || value > 100) {
      toast({ title: 'Xatolik', description: "Foiz 0 dan 100 gacha bo'lishi kerak", variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      await settingsApi.setCommission(value);
      toast({ title: 'Saqlandi', description: "Standart komissiya foizi yangilandi", variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', description: 'Saqlashda xatolik', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Sozlamalar" icon={<Percent className="h-4 w-4" />} />

      {error ? (
        <ErrorState message={error} onRetry={fetchCommission} />
      ) : (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary-text" aria-hidden="true" />
              Platforma komissiyasi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-body text-muted">
              Har bir yakunlangan safardan haydovchi balansidan ushlab qolinadigan standart
              komissiya foizi. Alohida haydovchilar uchun (masalan, reklama tashigani uchun)
              haydovchi profilida boshqacha foiz belgilash mumkin.
            </p>
            {isLoading ? (
              <SkeletonForm fields={1} />
            ) : (
              <Input
                label="Standart komissiya foizi, %"
                type="number"
                min={0}
                max={100}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            )}
            <Button onClick={handleSave} isLoading={saving} disabled={isLoading}>
              Saqlash
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
