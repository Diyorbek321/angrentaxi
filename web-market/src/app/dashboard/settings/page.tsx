'use client';

import { useEffect, useState } from 'react';
import { Check, LocateFixed, Settings as SettingsIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { marketApi, Store, DeliveryMode } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: store, isLoading, error, reload } = useAsyncData<Store>(async () => {
    const res = await marketApi.getStore();
    return res.data.data;
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('22:00');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('platform');
  const [saving, setSaving] = useState(false);

  // Seeds the form once the store arrives. Kept as local state (not derived)
  // because these fields are edited before they are saved back.
  useEffect(() => {
    if (!store) return;
    setName(store.name);
    setPhone(store.phone ?? '');
    setAddress(store.address ?? '');
    setLat(store.lat != null ? String(store.lat) : '');
    setLng(store.lng != null ? String(store.lng) : '');
    setStart(store.workingHoursStart);
    setEnd(store.workingHoursEnd);
    setDeliveryMode(store.deliveryMode);
  }, [store]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Joylashuv qo‘llab-quvvatlanmaydi', variant: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocating(false);
      },
      () => {
        toast({ title: 'Joylashuvga ruxsat berilmadi', variant: 'error' });
        setLocating(false);
      }
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await marketApi.updateStore({
        name,
        phone,
        address,
        workingHoursStart: start,
        workingHoursEnd: end,
        deliveryMode,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
      });
      await reload();
      toast({ title: 'Saqlandi', variant: 'success' });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err, 'Saqlab bo‘lmadi'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Sozlamalar"
        description="Do'kon profili va yetkazib berish"
        icon={<SettingsIcon size={18} aria-hidden />}
      />

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <span className="sr-only">Yuklanmoqda</span>
          <Skeleton className="h-72 rounded-ds-md" />
          <Skeleton className="h-40 rounded-ds-md" />
          <Skeleton className="h-32 rounded-ds-md" />
        </div>
      ) : error && !store ? (
        <ErrorState message={error} onRetry={reload} />
      ) : store ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Do&apos;kon ma&apos;lumotlari</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Input label="Do'kon nomi" value={name} onChange={(e) => setName(e.target.value)} />
              <Input
                label="Telefon"
                mono
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Olib ketish manzili"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <Input
                label="Kenglik (lat)"
                mono
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="40.0956"
              />
              <Input
                label="Uzunlik (lng)"
                mono
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="70.9432"
              />
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={useCurrentLocation}
                  isLoading={locating}
                  leftIcon={<LocateFixed size={14} aria-hidden />}
                >
                  Hozirgi joylashuvni olish
                </Button>
                <p className="mt-1 text-caption text-subtle">
                  Kuryer buyurtmani shu manzildan olib ketadi — koordinatalar aniq bo&apos;lishi
                  kerak.
                </p>
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <CardTitle>Yetkazib berish usuli</CardTitle>
            </CardHeader>
            <div role="radiogroup" aria-label="Yetkazib berish usuli" className="flex flex-col gap-3 sm:flex-row">
              <DeliveryOption
                title="O'zi yetkazadi"
                desc="Do'kon o'z kuryeri bilan yetkazadi"
                active={deliveryMode === 'self'}
                onClick={() => setDeliveryMode('self')}
              />
              <DeliveryOption
                title="Platforma kuryeri"
                desc="Angren Taxi kuryerlari yetkazadi"
                active={deliveryMode === 'platform'}
                onClick={() => setDeliveryMode('platform')}
              />
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <CardTitle>Ish vaqti</CardTitle>
            </CardHeader>
            <div className="flex flex-wrap items-end gap-3.5">
              <div className="w-32">
                <Input
                  label="Ochilish"
                  type="time"
                  mono
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="w-32">
                <Input
                  label="Yopilish"
                  type="time"
                  mono
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
              <span className="pb-2.5 text-caption text-muted">Har kuni</span>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" isLoading={saving} leftIcon={<Check size={15} aria-hidden />}>
              Saqlash
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function DeliveryOption({
  title,
  desc,
  active,
  onClick,
}: {
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={clsx(
        'flex-1 rounded-ds-sm border p-4 text-left transition-colors duration-fast',
        active
          ? 'border-primary bg-mint-tint ring-1 ring-primary/30'
          : 'border-line bg-surface hover:bg-surface-2'
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-body font-bold text-ink">{title}</span>
        <span
          aria-hidden
          className={clsx(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
            active ? 'border-primary' : 'border-line-strong'
          )}
        >
          {active && <span className="h-2 w-2 rounded-full bg-primary" />}
        </span>
      </span>
      <span className="mt-1.5 block text-caption text-muted">{desc}</span>
    </button>
  );
}
