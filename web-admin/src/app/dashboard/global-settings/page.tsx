'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Settings } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonForm } from '@/components/ui/Skeleton';
import { settingsApi, GlobalSettings } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function GlobalSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<GlobalSettings>({
    platformName: '',
    supportPhone: '',
    supportEmail: '',
    maintenanceMode: false,
  });

  const fetchSettings = () => {
    setIsLoading(true);
    settingsApi
      .getGlobal()
      .then((res) => {
        setForm(res.data.data);
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
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.updateGlobal(form);
      setForm(res.data.data);
      toast({ title: 'Saqlandi', variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', description: 'Saqlashda xatolik', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Umumiy sozlamalar"
        description="Platforma nomi, aloqa va texnik profilaktika rejimi"
        icon={<Settings className="h-4 w-4" />}
      />

      {error ? (
        <ErrorState message={error} onRetry={fetchSettings} />
      ) : isLoading ? (
        <div className="max-w-2xl">
          <SkeletonForm fields={4} />
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platforma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Platforma nomi"
                value={form.platformName}
                onChange={(e) => setForm((f) => ({ ...f, platformName: e.target.value }))}
              />
              <Input
                label="Qo'llab-quvvatlash telefoni"
                value={form.supportPhone}
                onChange={(e) => setForm((f) => ({ ...f, supportPhone: e.target.value }))}
              />
              <Input
                label="Qo'llab-quvvatlash emaili"
                value={form.supportEmail}
                onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Texnik profilaktika rejimi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-ds-md bg-surface-2 px-4 py-3">
                <div>
                  <p className="text-body font-medium text-ink">Maintenance mode</p>
                  <p className="mt-0.5 text-caption text-muted">
                    Faqat belgi sifatida saqlanadi — hozircha haqiqiy so&apos;rovlarni bloklamaydi.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.maintenanceMode}
                  aria-label="Texnik profilaktika rejimi"
                  onClick={() => setForm((f) => ({ ...f, maintenanceMode: !f.maintenanceMode }))}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                    form.maintenanceMode ? 'bg-danger' : 'bg-surface-3'
                  }`}
                >
                  {/* Tugmacha ikkala temada ham oq qoladi: yo'lakcha yo
                      `danger` (3.9:1), yo `surface-3` (qorong'ida 1.6:1 emas,
                      oq bilan 11:1) — tokenli yuza bu yerda ko'rinmay qolardi. */}
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-transform ${
                      form.maintenanceMode ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              {form.maintenanceMode && (
                <div className="flex items-start gap-2 rounded-ds-md border border-danger/30 bg-danger-tint px-3 py-2.5">
                  <AlertTriangle
                    size={15}
                    className="mt-0.5 shrink-0 text-danger-deep dark:text-danger-light"
                    aria-hidden="true"
                  />
                  <p className="text-caption text-danger-deep dark:text-danger-light">
                    Belgi yoqildi, lekin bu real trafikni bloklamaydi — bu qadam ataylab qo&apos;shilmagan
                    (jonli tizimga ta&apos;sir qiladigan o&apos;zgarish, alohida tasdiq talab qiladi).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleSave} isLoading={saving}>
            Saqlash
          </Button>
        </div>
      )}
    </div>
  );
}
