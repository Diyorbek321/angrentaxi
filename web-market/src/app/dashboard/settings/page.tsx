'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, LocateFixed, Store as StoreIcon, Truck } from 'lucide-react';
import { marketApi, type DeliveryMode, type Store } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DELIVERY_MODE_LABEL } from '@/lib/orderStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const DELIVERY_OPTIONS: Array<{ value: DeliveryMode; title: string; description: string }> = [
  {
    value: 'self',
    title: DELIVERY_MODE_LABEL.self,
    description: "Buyurtmani do'kon o'z kuryeri bilan yetkazadi.",
  },
  {
    value: 'platform',
    title: DELIVERY_MODE_LABEL.platform,
    description: 'Angren Taxi kuryerlari olib ketadi — koordinatalar aniq bo‘lsin.',
  },
];

export default function SettingsPage() {
  const { toast } = useToast();

  const [store, setStore] = useState<Store | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('22:00');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('platform');
  const [threshold, setThreshold] = useState('10');

  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const applyStore = (s: Store) => {
    setStore(s);
    setName(s.name);
    setPhone(s.phone ?? '');
    setAddress(s.address ?? '');
    setLat(s.lat != null ? String(s.lat) : '');
    setLng(s.lng != null ? String(s.lng) : '');
    setStart(s.workingHoursStart);
    setEnd(s.workingHoursEnd);
    setDeliveryMode(s.deliveryMode);
    setThreshold(String(s.lowStockThreshold));
  };

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const res = await marketApi.getStore();
      applyStore(res.data.data);
      setStatus('ready');
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : null);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Joylashuv qo‘llab-quvvatlanmaydi', variant: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        toast({ title: 'Joylashuvga ruxsat berilmadi', variant: 'error' });
        setLocating(false);
      }
    );
  };

  const save = async () => {
    // Mirrors the backend DTO's constraints, so an invalid value is caught
    // here instead of coming back as a 400.
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Do‘kon nomini kiriting';
    if (!TIME_RE.test(start)) next.start = 'Vaqt HH:mm ko‘rinishida';
    if (!TIME_RE.test(end)) next.end = 'Vaqt HH:mm ko‘rinishida';
    const thresholdValue = Number(threshold);
    if (!Number.isInteger(thresholdValue) || thresholdValue < 1 || thresholdValue > 50) {
      next.threshold = '1 dan 50 gacha butun son';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const res = await marketApi.updateStore({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        workingHoursStart: start,
        workingHoursEnd: end,
        deliveryMode,
        lowStockThreshold: thresholdValue,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
      });
      applyStore(res.data.data);
      toast({ title: 'Saqlandi', variant: 'success' });
    } catch {
      toast({ title: 'Saqlab bo‘lmadi', description: 'Qayta urinib ko‘ring.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (status === 'error' || !store) return <ErrorState message={loadError} onRetry={load} />;

  return (
    <div className="max-w-3xl space-y-4 animate-fade-in pb-2">
      <Card>
        <CardHeader
          title="Do'kon ma'lumotlari"
          subtitle="Mijozlar va kuryerlar shu ma'lumotlarni ko'radi"
          icon={<StoreIcon size={16} />}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <Input
            label="Do'kon nomi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <Input
            label="Telefon"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998901234567"
            mono
          />
          <div className="md:col-span-2">
            <Input
              label="Olib ketish manzili"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Angren sh., Bozor ko'chasi 14"
            />
          </div>
          <Input
            label="Kenglik (lat)"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="40.0956"
            mono
          />
          <Input
            label="Uzunlik (lng)"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="70.9432"
            mono
          />
          <div className="md:col-span-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={useCurrentLocation}
              isLoading={locating}
              leftIcon={<LocateFixed size={14} />}
              className="text-primary-700 dark:text-primary-300 -ml-1.5"
            >
              Hozirgi joylashuvni olish
            </Button>
            <p className="text-2xs text-subtle mt-1">
              Kuryer buyurtmani shu nuqtadan oladi — koordinatalar aniq bo&apos;lishi kerak.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Yetkazib berish"
          subtitle="Buyurtmani kim yetkazadi"
          icon={<Truck size={16} />}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DELIVERY_OPTIONS.map((option) => {
            const active = deliveryMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setDeliveryMode(option.value)}
                aria-pressed={active}
                className={cn(
                  'text-left rounded-xl border p-3.5 transition-colors',
                  active
                    ? 'border-primary/50 bg-primary/[0.07]'
                    : 'border-line bg-surface hover:bg-surface-2'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{option.title}</span>
                  <span
                    className={cn(
                      'h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center',
                      active ? 'border-primary' : 'border-line-strong'
                    )}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">{option.description}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Ish vaqti va zaxira" icon={<Clock size={16} />} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <Input
            label="Ochilish"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="08:00"
            error={errors.start}
            mono
          />
          <Input
            label="Yopilish"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="22:00"
            error={errors.end}
            mono
          />
          <Input
            label="Kam zaxira chegarasi"
            type="number"
            min={1}
            max={50}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            error={errors.threshold}
            hint={errors.threshold ? undefined : 'Shu sondan kam qolganda ogohlantiriladi'}
            mono
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} isLoading={saving} leftIcon={<Check size={15} />}>
          Saqlash
        </Button>
      </div>
    </div>
  );
}
