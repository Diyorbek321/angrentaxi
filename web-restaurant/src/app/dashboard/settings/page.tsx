'use client';

import { useCallback, useEffect, useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import { foodApi, Notifications, Restaurant, WorkingHoursDay } from '@/lib/api';
import { useAsyncData, errorMessage } from '@/hooks/useAsyncData';
import { catalogImageForm, catalogImageSrc, ImageChange } from '@/lib/catalog-image';
import { usePageRefresh } from '@/components/shell';
import { tinError } from '@/lib/tin';
import { ImagePicker } from '@/components/ImagePicker';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonForm } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
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
  /** STIR (9 raqam) — fiskal chek uchun; bo'sh — kiritilmagan. */
  tin: string;
  /** Saqlangan muqova kaliti va formadagi tanlov. */
  imageKey: string | null;
  image: ImageChange;
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
    tin: r.tin ?? '',
    imageKey: r.imageKey ?? null,
    image: { kind: 'keep' },
  };
}

/** Rasm tanlovidan tashqari maydonlar — "saqlanmagan o'zgarish" bormi. */
function isDirty(draft: Draft, baseline: Draft): boolean {
  const strip = ({ image: _image, ...rest }: Draft) => rest;
  return draft.image.kind !== 'keep' || JSON.stringify(strip(draft)) !== JSON.stringify(strip(baseline));
}

const NOTIFICATION_ROWS: { key: keyof Notifications; title: string; subtitle: string }[] = [
  { key: 'sound', title: 'Yangi buyurtma ovozi', subtitle: 'Buyurtma kelganda signal chalinadi' },
  { key: 'push', title: 'Push bildirishnomalar', subtitle: 'Brauzer bildirishnomalari' },
  { key: 'sms', title: 'SMS xabarnoma', subtitle: 'Muhim voqealar haqida SMS' },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async (): Promise<Restaurant> => {
    const res = await foodApi.getRestaurant();
    return res.data.data;
  }, []);

  const { data, status, error, reload } = useAsyncData<Restaurant>(load);
  usePageRefresh(reload);

  const reset = useCallback((r: Restaurant) => {
    const next = toDraft(r);
    setDraft(next);
    setBaseline(next);
  }, []);

  // Server javobi kelganda formani bir marta to'ldiramiz. Keyingi fon
  // yangilanishlari foydalanuvchi kiritgan matnni bosib ketmasligi kerak.
  useEffect(() => {
    if (data && draft === null) reset(data);
  }, [data, draft, reset]);

  const patch = (partial: Partial<Draft>) => setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
  const patchDay = (idx: number, partial: Partial<WorkingHoursDay>) =>
    setDraft((prev) =>
      prev ? { ...prev, hours: prev.hours.map((d, i) => (i === idx ? { ...d, ...partial } : d)) } : prev
    );

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
    const tinInvalid = tinError(draft.tin);
    if (tinInvalid) {
      toast({ title: 'STIR notoʻgʻri', description: tinInvalid, variant: 'error' });
      return;
    }
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
        // Bo'sh — STIR olib tashlanadi (null), aks holda 9 raqam.
        tin: draft.tin.trim() === '' ? null : draft.tin.trim(),
      });
      reset(res.data.data);
    } catch (err) {
      toast({ title: 'Saqlab bo‘lmadi', description: errorMessage(err), variant: 'error' });
      setSaving(false);
      return;
    }
    // Muqova alohida so'rov: almashtirilganda eski rasm serverda o'chadi.
    try {
      if (draft.image.kind === 'set') {
        const res = await foodApi.uploadRestaurantImage(await catalogImageForm(draft.image.file));
        reset(res.data.data);
      } else if (draft.image.kind === 'remove') {
        const res = await foodApi.removeRestaurantImage();
        reset(res.data.data);
      }
      toast({ title: 'Saqlandi', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Maʼlumotlar saqlandi, lekin muqova yangilanmadi',
        description: errorMessage(err),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const openDays = draft?.hours.filter((h) => h.open).length ?? 0;
  const dirty = draft != null && baseline != null && isDirty(draft, baseline);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader title="Sozlamalar" description="Restoran profili, ish vaqti, yetkazib berish va bildirishnomalar" />

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

      {status === 'error' && <ErrorState title="Sozlamalarni yuklab boʻlmadi" message={error} onRetry={reload} />}

      {status === 'ready' && draft && (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card padding="none">
              <CardHeader title="Restoran maʼlumotlari" description="Mijoz ilovasida koʻrinadi" />
              <CardBody className="flex flex-col gap-4">
                <ImagePicker
                  label="Muqova rasmi"
                  currentSrc={catalogImageSrc(draft.imageKey)}
                  value={draft.image}
                  onChange={(image) => patch({ image })}
                  aspectClassName="aspect-[16/9]"
                />
                <Input label="Nomi" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
                <Input
                  label="Telefon"
                  inputMode="tel"
                  className="num"
                  value={draft.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                  placeholder="+998901234567"
                />
                <Input
                  label="Manzil"
                  value={draft.address}
                  onChange={(e) => patch({ address: e.target.value })}
                  leftElement={<MapPin size={15} />}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Kenglik (lat)"
                    inputMode="decimal"
                    className="num"
                    value={draft.lat}
                    onChange={(e) => patch({ lat: e.target.value })}
                    placeholder="40.1050"
                  />
                  <Input
                    label="Uzunlik (lng)"
                    inputMode="decimal"
                    className="num"
                    value={draft.lng}
                    onChange={(e) => patch({ lng: e.target.value })}
                    placeholder="70.9500"
                    hint="Kuryer buyurtmani shu nuqtadan oladi"
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
              </CardBody>
            </Card>

            <div className="flex flex-col gap-4">
              <Card padding="none">
                <CardHeader
                  title="Ish vaqti"
                  actions={
                    <Badge variant={openDays > 0 ? 'neutral' : 'danger'} size="sm">
                      {openDays} kun ochiq
                    </Badge>
                  }
                  divider
                />
                {draft.hours.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[13px] text-muted">Ish vaqti jadvali hali sozlanmagan</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {draft.hours.map((h, idx) => (
                      <li key={h.day} className="flex min-h-[48px] flex-wrap items-center gap-3 px-4 py-2">
                        <Switch
                          size="sm"
                          checked={h.open}
                          onCheckedChange={(open) => patchDay(idx, { open })}
                          aria-label={`${h.day} — ochiq`}
                        />
                        <span className={cn('w-24 text-[13px] font-medium', h.open ? 'text-ink' : 'text-muted')}>
                          {h.day}
                        </span>
                        {h.open ? (
                          <div className="ml-auto flex items-center gap-1.5">
                            <Input
                              type="time"
                              size="sm"
                              aria-label={`${h.day} — ochilish vaqti`}
                              value={h.from}
                              onChange={(e) => patchDay(idx, { from: e.target.value })}
                              className="num"
                              wrapperClassName="w-28"
                            />
                            <span className="text-subtle" aria-hidden>
                              –
                            </span>
                            <Input
                              type="time"
                              size="sm"
                              aria-label={`${h.day} — yopilish vaqti`}
                              value={h.to}
                              onChange={(e) => patchDay(idx, { to: e.target.value })}
                              className="num"
                              wrapperClassName="w-28"
                            />
                          </div>
                        ) : (
                          <span className="ml-auto text-[13px] text-muted">Dam olish kuni</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card padding="none">
                <CardHeader title="Soliq maʼlumotlari" description="Fiskal chek uchun" />
                <CardBody>
                  <Input
                    label="STIR (INN)"
                    inputMode="numeric"
                    autoComplete="off"
                    className="num"
                    maxLength={9}
                    placeholder="123456789"
                    value={draft.tin}
                    onChange={(e) => patch({ tin: e.target.value.replace(/\D/g, '') })}
                    error={tinError(draft.tin) ?? undefined}
                    hint="Fiskal chekda koʻrsatiladi. 9 ta raqam; kiritilmasa chekda restoran koʻrinmaydi."
                  />
                </CardBody>
              </Card>

              <Card padding="none">
                <CardHeader title="Yetkazib berish zonasi" description="Restorandan maksimal masofa" />
                <CardBody>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="radius" className="text-[13px] font-medium text-ink">
                      Radius
                    </label>
                    <span className="num text-title text-ink">{draft.radius} km</span>
                  </div>
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
                  <div className="num mt-1 flex justify-between text-[11px] text-subtle" aria-hidden>
                    <span>1 km</span>
                    <span>15 km</span>
                  </div>
                </CardBody>
              </Card>

              <Card padding="none">
                <CardHeader title="Bildirishnomalar" divider />
                <ul className="divide-y divide-line">
                  {NOTIFICATION_ROWS.map((row) => (
                    <li key={row.key} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-ink">{row.title}</p>
                        <p className="text-xs text-muted">{row.subtitle}</p>
                      </div>
                      <Switch
                        checked={draft.notifications[row.key]}
                        onCheckedChange={(on) => patch({ notifications: { ...draft.notifications, [row.key]: on } })}
                        aria-label={row.title}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>

          {/* Yopishqoq saqlash paneli — uzun formaning qayerida bo'lmasin ko'rinadi. */}
          <div className="sticky bottom-0 z-10 -mx-4 -mb-5 mt-5 flex items-center justify-end gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <p className={cn('mr-auto text-[13px]', dirty ? 'text-ink' : 'text-muted')} role="status">
              {dirty ? 'Saqlanmagan oʻzgarishlar bor' : 'Barcha oʻzgarishlar saqlangan'}
            </p>
            <Button variant="secondary" disabled={!dirty || saving} onClick={() => baseline && setDraft(baseline)}>
              Bekor qilish
            </Button>
            <Button isLoading={saving} disabled={!dirty} onClick={save}>
              Saqlash
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
