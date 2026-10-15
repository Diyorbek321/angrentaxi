'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, LocateFixed } from 'lucide-react';
import { marketApi, Store, DeliveryMode } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { catalogImageForm, catalogImageSrc, ImageChange } from '@/lib/catalog-image';
import { ImagePicker } from '@/components/ImagePicker';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { SkeletonForm } from '@/components/ui/Skeleton';
import { usePageRefresh } from '@/components/shell';
import { tinError } from '@/lib/tin';

const DELIVERY_OPTIONS = [
  { value: 'self' as const, label: "O'zi yetkazadi", description: "Do'kon o'z kuryeri bilan yetkazadi" },
  { value: 'platform' as const, label: 'Platforma kuryeri', description: 'Angren Taxi kuryerlari yetkazadi' },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: store, isLoading, isRefreshing, error, reload } = useAsyncData<Store>(async () => {
    const res = await marketApi.getStore();
    return res.data.data;
  });
  usePageRefresh(reload);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('22:00');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('platform');
  const [threshold, setThreshold] = useState('10');
  const [tin, setTin] = useState('');
  const [image, setImage] = useState<ImageChange>({ kind: 'keep' });
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
    setThreshold(String(store.lowStockThreshold));
    setTin(store.tin ?? '');
  }, [store]);

  // Saqlanmagan o'zgarish bormi — sticky saqlash paneli shunga qarab gapiradi.
  const dirty = useMemo(() => {
    if (!store) return false;
    return (
      name !== store.name ||
      phone !== (store.phone ?? '') ||
      address !== (store.address ?? '') ||
      lat !== (store.lat != null ? String(store.lat) : '') ||
      lng !== (store.lng != null ? String(store.lng) : '') ||
      start !== store.workingHoursStart ||
      end !== store.workingHoursEnd ||
      deliveryMode !== store.deliveryMode ||
      threshold !== String(store.lowStockThreshold) ||
      tin.trim() !== (store.tin ?? '') ||
      image.kind !== 'keep'
    );
  }, [store, name, phone, address, lat, lng, start, end, deliveryMode, threshold, tin, image]);
  const tinInvalid = tinError(tin);

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
    if (tinInvalid) {
      toast({ title: 'STIR notoʻgʻri', description: tinInvalid, variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      await marketApi.updateStore({
        name,
        phone,
        address,
        workingHoursStart: start,
        workingHoursEnd: end,
        deliveryMode,
        lowStockThreshold: Math.max(0, Number(threshold) || 0),
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
        // Bo'sh — STIR olib tashlanadi (null), aks holda 9 raqam.
        tin: tin.trim() === '' ? null : tin.trim(),
      });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err, 'Saqlab bo‘lmadi'), variant: 'error' });
      setSaving(false);
      return;
    }
    // Muqova alohida so'rov: almashtirilganda eski rasm serverda o'chadi.
    try {
      if (image.kind === 'set') await marketApi.uploadStoreImage(await catalogImageForm(image.file));
      else if (image.kind === 'remove') await marketApi.removeStoreImage();
      setImage({ kind: 'keep' });
      toast({ title: 'Saqlandi', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Maʼlumotlar saqlandi, lekin muqova yangilanmadi',
        description: errorMessage(err, 'Rasmni saqlab boʻlmadi'),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
    await reload();
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Sozlamalar" description="Do'kon profili, yetkazib berish va zaxira ogohlantirishi" />

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <span className="sr-only">Yuklanmoqda</span>
          <Card>
            <SkeletonForm fields={5} />
          </Card>
          <Card>
            <SkeletonForm fields={2} />
          </Card>
        </div>
      ) : error && !store ? (
        <ErrorState message={error} onRetry={reload} retrying={isRefreshing} />
      ) : store ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Card padding="none">
            <CardHeader title="Do'kon ma'lumotlari" description="Mijoz ilovasida ko'rinadi" divider />
            <CardBody className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <ImagePicker
                  label="Muqova rasmi"
                  currentSrc={catalogImageSrc(store.imageKey)}
                  value={image}
                  onChange={setImage}
                  aspectClassName="aspect-[16/9]"
                />
              </div>
              <Input label="Do'kon nomi" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                label="Telefon"
                inputMode="tel"
                className="num"
                placeholder="+998 90 123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                label="Olib ketish manzili"
                wrapperClassName="sm:col-span-2"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <Input
                label="Kenglik (lat)"
                className="num"
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="40.0956"
              />
              <Input
                label="Uzunlik (lng)"
                className="num"
                inputMode="decimal"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="70.9432"
              />
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={useCurrentLocation}
                  isLoading={locating}
                  leftIcon={<LocateFixed size={14} aria-hidden />}
                >
                  Hozirgi joylashuvni olish
                </Button>
                <p className="text-xs text-muted">
                  Kuryer buyurtmani shu manzildan olib ketadi — koordinatalar aniq bo&apos;lishi kerak.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title="Soliq maʼlumotlari" description="Fiskal chek uchun" divider />
            <CardBody className="pt-4">
              <Input
                label="STIR (INN)"
                inputMode="numeric"
                autoComplete="off"
                className="num"
                wrapperClassName="max-w-[16rem]"
                maxLength={9}
                placeholder="123456789"
                value={tin}
                onChange={(e) => setTin(e.target.value.replace(/\D/g, ''))}
                error={tinInvalid ?? undefined}
                hint="Fiskal chekda koʻrsatiladi. 9 ta raqam; kiritilmasa chekda doʻkon koʻrinmaydi."
              />
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title="Yetkazib berish usuli" description="Har buyurtmada kim yetkazishini belgilaydi" divider />
            <CardBody className="pt-4">
              <RadioGroup<DeliveryMode>
                name="deliveryMode"
                options={DELIVERY_OPTIONS}
                value={deliveryMode}
                onChange={setDeliveryMode}
                orientation="horizontal"
              />
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title="Ish vaqti" description="Har kuni bir xil" divider />
            <CardBody className="flex flex-wrap gap-4 pt-4">
              <Input
                label="Ochilish"
                type="time"
                className="num"
                wrapperClassName="w-36"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <Input
                label="Yopilish"
                type="time"
                className="num"
                wrapperClassName="w-36"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title="Zaxira ogohlantirishi" divider />
            <CardBody className="pt-4">
              <Input
                label="Kam zaxira chegarasi"
                type="number"
                className="num"
                wrapperClassName="max-w-[12rem]"
                min={0}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                hint="Zaxirasi shu sondan kam yoki teng mahsulotlar «Zaxira» va bosh sahifada ogohlantirish bo'lib chiqadi."
              />
            </CardBody>
          </Card>

          {/* Yopishqoq saqlash paneli: uzun formada tugma doim qo'l ostida. */}
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex max-w-3xl items-center justify-end gap-3">
              <p className="mr-auto text-[13px] text-muted" aria-live="polite">
                {dirty ? 'Saqlanmagan oʻzgarishlar bor' : 'Barcha oʻzgarishlar saqlangan'}
              </p>
              <Button type="submit" isLoading={saving} disabled={!dirty && !saving} leftIcon={<Check size={14} aria-hidden />}>
                Saqlash
              </Button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
