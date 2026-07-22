'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { settingsApi, GlobalSettings } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function GlobalSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<GlobalSettings>({
    platformName: '',
    supportPhone: '',
    supportEmail: '',
    maintenanceMode: false,
  });

  useEffect(() => {
    settingsApi
      .getGlobal()
      .then((res) => setForm(res.data.data))
      .catch(() => toast({ title: 'Xatolik', description: 'Sozlamalarni yuklashda xatolik', variant: 'error' }))
      .finally(() => setIsLoading(false));
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

  if (isLoading) {
    return (
      <div>
        <Header title="Umumiy sozlamalar" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Umumiy sozlamalar" subtitle="Platforma nomi, aloqa va texnik profilaktika rejimi" />
      <div className="p-6 space-y-6 max-w-2xl">
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
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-100">Maintenance mode</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Faqat belgi sifatida saqlanadi — hozircha haqiqiy so&apos;rovlarni bloklamaydi.
                </p>
              </div>
              <button
                onClick={() => setForm((f) => ({ ...f, maintenanceMode: !f.maintenanceMode }))}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  form.maintenanceMode ? 'bg-red-500' : 'bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    form.maintenanceMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            {form.maintenanceMode && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                <AlertTriangle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300">
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
    </div>
  );
}
