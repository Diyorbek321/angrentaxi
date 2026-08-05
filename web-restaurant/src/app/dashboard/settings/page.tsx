'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Check, Clock, LocateFixed, MapPin, Settings as SettingsIcon, Smartphone, Volume2 } from 'lucide-react';
import { clsx } from 'clsx';
import { foodApi, Notifications, Restaurant, WorkingHoursDay } from '@/lib/api';
import { useAsyncData, errorMessage } from '@/hooks/useAsyncData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonForm } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface Draft {
  name: string;
  phone: string;
  address: string;
  lat: string;
  lng: string;
  hours: WorkingHoursDay[];
  radius: number;
  notifications: Notifications;
}

function toDraft(r: Restaurant): Draft {
  return {
    name: r.name,
    phone: r.phone ?? '',
    address: r.address ?? '',
    lat: r.lat != null ? String(r.lat) : '',
    lng: r.lng != null ? String(r.lng) : '',
    hours: r.hours ?? [],
    radius: r.deliveryRadiusKm,
    notifications: r.notifications,
  };
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async (): Promise<Restaurant> => {
    const res = await foodApi.getRestaurant();
    return res.data.data;
  }, []);

  const { data, status, error, reload } = useAsyncData<Restaurant>(load);

  // Server javobi kelganda formani bir marta to'ldiramiz. Keyingi fon
  // yangilanishlari foydalanuvchi kiritgan matnni bosib ketmasligi kerak.
  useEffect(() => {
    if (data && draft === null) setDraft(toDraft(data));
  }, [data, draft]);

  const patch = (partial: Partial<Draft>) => setDraft((prev) => (prev ? { ...prev, ...partial } : prev));

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Joylashuv qo‘llab-quvvatlanmaydi', variant: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        patch({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) });
        setLocating(false);
      },
      () => {
        toast({ title: 'Joylashuvga ruxsat berilmadi', variant: 'error' });
        setLocating(false);
      }
    );
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await foodApi.updateRestaurant({
        name: draft.name,
        phone: draft.phone,
        address: draft.address,
        hours: draft.hours,
        deliveryRadiusKm: draft.radius,
        notifications: draft.notifications,
        lat: draft.lat ? Number(draft.lat) : undefined,
        lng: draft.lng ? Number(draft.lng) : undefined,
      });
      setDraft(toDraft(res.data.data));
      toast({ title: 'Saqlandi', variant: 'success' });
    } catch (err) {
      toast({ title: 'Saqlab bo‘lmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openDays = draft?.hours.filter((h) => h.open).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl pb-4">
      <PageHeader
        title="Sozlamalar"
        description="Restoran profili, ish vaqti va yetkazib berish"
        icon={<SettingsIcon size={20} />}
        actions={
          <Button leftIcon={<Check size={16} />} isLoading={saving} disabled={!draft} onClick={save}>
            Saqlash
          </Button>
        }
      />

      {status === 'loading' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card padding="lg">
            <SkeletonForm fields={4} />
          </Card>
          <Card padding="lg">
            <SkeletonForm fields={4} />
          </Card>
        </div>
      )}

      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' && draft && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Restoran ma&apos;lumotlari</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-4">
              <Input label="Nomi" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
              <Input
                label="Telefon"
                mono
                inputMode="tel"
                value={draft.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                placeholder="+998901234567"
              />
              <Input
                label="Manzil"
                value={draft.address}
                onChange={(e) => patch({ address: e.target.value })}
                leftElement={<MapPin size={16} />}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Kenglik (lat)"
                  mono
                  value={draft.lat}
                  onChange={(e) => patch({ lat: e.target.value })}
                  placeholder="40.1050"
                />
                <Input
                  label="Uzunlik (lng)"
                  mono
                  value={draft.lng}
                  onChange={(e) => patch({ lng: e.target.value })}
                  placeholder="70.9500"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                isLoading={locating}
                leftIcon={<LocateFixed size={14} />}
                onClick={useCurrentLocation}
              >
                Hozirgi joylashuvni olish
              </Button>
              <p className="text-caption text-subtle">
                Kuryer buyurtmani shu nuqtadan oladi — koordinatalar aniq bo&apos;lishi kerak.
              </p>
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <CardTitle>Ish vaqti</CardTitle>
              <Badge variant={openDays > 0 ? 'success' : 'warning'} size="sm">
                {openDays} kun ochiq
              </Badge>
            </CardHeader>

            <ul className="flex flex-col gap-2">
              {draft.hours.map((h, idx) => (
                <li
                  key={h.day}
                  className={clsx(
                    'flex flex-wrap items-center gap-3 rounded-ds-sm border px-3 py-2.5',
                    h.open ? 'border-line bg-surface' : 'border-dashed border-line bg-surface-2/60'
                  )}
                >
                  <span className="w-24 text-label text-ink">{h.day}</span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={h.open}
                    aria-label={`${h.day} — ${h.open ? 'ochiq' : 'dam olish kuni'}`}
                    onClick={() =>
                      patch({ hours: draft.hours.map((d, i) => (i === idx ? { ...d, open: !d.open } : d)) })
                    }
                    className={clsx(
                      'flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-fast',
                      h.open ? 'bg-primary justify-end dark:bg-primary-on-dark' : 'bg-surface-3 justify-start'
                    )}
                  >
                    <span className="block h-6 w-6 rounded-full bg-surface shadow-card" />
                  </button>

                  {h.open ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        aria-label={`${h.day} — ochilish vaqti`}
                        value={h.from}
                        onChange={(e) =>
                          patch({
                            hours: draft.hours.map((d, i) => (i === idx ? { ...d, from: e.target.value } : d)),
                          })
                        }
                        className="rounded-ds-xs border border-line bg-surface px-2.5 py-1.5 font-mono text-body text-ink"
                      />
                      <span className="text-muted" aria-hidden>
                        –
                      </span>
                      <input
                        type="time"
                        aria-label={`${h.day} — yopilish vaqti`}
                        value={h.to}
                        onChange={(e) =>
                          patch({
                            hours: draft.hours.map((d, i) => (i === idx ? { ...d, to: e.target.value } : d)),
                          })
                        }
                        className="rounded-ds-xs border border-line bg-surface px-2.5 py-1.5 font-mono text-body text-ink"
                      />
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-caption text-muted">
                      <Clock size={13} aria-hidden />
                      Dam olish kuni
                    </span>
                  )}
                </li>
              ))}
              {draft.hours.length === 0 && (
                <li className="rounded-ds-sm border border-dashed border-line px-3 py-6 text-center text-caption text-subtle">
                  Ish vaqti jadvali hali sozlanmagan
                </li>
              )}
            </ul>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <CardTitle>Yetkazib berish zonasi</CardTitle>
              <span className="font-mono text-title text-primary-text">{draft.radius} km</span>
            </CardHeader>

            <div
              aria-hidden
              className="relative mb-4 flex h-44 items-center justify-center overflow-hidden rounded-ds-sm border border-line bg-surface-2"
            >
              <span className="absolute h-36 w-36 rounded-full border border-mint/30" />
              <span className="absolute h-24 w-24 rounded-full border border-mint/45 bg-mint/10" />
              <span className="absolute h-12 w-12 rounded-full border border-mint/60 bg-mint/15" />
              <span className="relative h-3.5 w-3.5 rounded-full bg-mint-deep" />
            </div>

            <label htmlFor="radius" className="text-caption font-semibold text-muted">
              Radius: {draft.radius} km
            </label>
            <input
              id="radius"
              type="range"
              min={1}
              max={15}
              step={1}
              value={draft.radius}
              onChange={(e) => patch({ radius: Number(e.target.value) })}
              className="range-primary mt-2 w-full"
            />
            <div className="mt-1 flex justify-between font-mono text-micro text-subtle">
              <span>1 km</span>
              <span>15 km</span>
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <CardTitle>Bildirishnomalar</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-4">
              <NotifRow
                icon={<Volume2 size={18} aria-hidden />}
                title="Yangi buyurtma ovozi"
                subtitle="Buyurtma kelganda signal chalinadi"
                on={draft.notifications.sound}
                onToggle={() =>
                  patch({ notifications: { ...draft.notifications, sound: !draft.notifications.sound } })
                }
              />
              <NotifRow
                icon={<Bell size={18} aria-hidden />}
                title="Push bildirishnomalar"
                subtitle="Brauzer bildirishnomalari"
                on={draft.notifications.push}
                onToggle={() =>
                  patch({ notifications: { ...draft.notifications, push: !draft.notifications.push } })
                }
              />
              <NotifRow
                icon={<Smartphone size={18} aria-hidden />}
                title="SMS xabarnoma"
                subtitle="Muhim voqealar haqida SMS"
                on={draft.notifications.sms}
                onToggle={() =>
                  patch({ notifications: { ...draft.notifications, sms: !draft.notifications.sms } })
                }
              />
            </div>
          </Card>

          <div className="lg:col-span-2 flex justify-end">
            <Button size="lg" leftIcon={<Check size={16} />} isLoading={saving} onClick={save}>
              O&apos;zgarishlarni saqlash
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NotifRow({
  icon,
  title,
  subtitle,
  on,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-sm',
          on ? 'bg-mint-tint text-primary-text' : 'bg-surface-2 text-subtle'
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-label text-ink">{title}</p>
        <p className="text-caption text-muted">{subtitle}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${title} — ${on ? 'yoqilgan' : "o'chirilgan"}`}
        onClick={onToggle}
        className={clsx(
          'flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-fast',
          on ? 'bg-primary justify-end dark:bg-primary-on-dark' : 'bg-surface-3 justify-start'
        )}
      >
        <span className="block h-6 w-6 rounded-full bg-surface shadow-card" />
      </button>
    </div>
  );
}
