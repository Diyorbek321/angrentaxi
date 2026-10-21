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
import { t } from '@/locales';

function deliveryOptions() {
  const m = t().settings;
  return [
    { value: 'self' as const, label: m.deliverySelf, description: m.deliverySelfDescription },
    { value: 'platform' as const, label: m.deliveryPlatform, description: m.deliveryPlatformDescription },
  ];
}

export default function SettingsPage() {
  const m = t();
  const s = m.settings;
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
      toast({ title: s.geoUnsupported, variant: 'error' });
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
        toast({ title: s.geoDenied, variant: 'error' });
        setLocating(false);
      }
    );
  };

  const save = async () => {
    if (tinInvalid) {
      toast({ title: s.tinInvalid, description: tinInvalid, variant: 'error' });
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
      toast({ title: m.common.error, description: errorMessage(err, s.saveFailed), variant: 'error' });
      setSaving(false);
      return;
    }
    // Muqova alohida so'rov: almashtirilganda eski rasm serverda o'chadi.
    try {
      if (image.kind === 'set') await marketApi.uploadStoreImage(await catalogImageForm(image.file));
      else if (image.kind === 'remove') await marketApi.removeStoreImage();
      setImage({ kind: 'keep' });
      toast({ title: m.common.saved, variant: 'success' });
    } catch (err) {
      toast({
        title: s.coverFailed,
        description: errorMessage(err, s.imageSaveFailed),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
    await reload();
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title={s.title} description={s.description} />

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <span className="sr-only">{m.common.loading}</span>
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
            <CardHeader title={s.storeInfo} description={s.storeInfoDescription} divider />
            <CardBody className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <ImagePicker
                  label={s.cover}
                  currentSrc={catalogImageSrc(store.imageKey)}
                  value={image}
                  onChange={setImage}
                  aspectClassName="aspect-[16/9]"
                />
              </div>
              <Input label={s.storeName} value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                label={s.phone}
                inputMode="tel"
                className="num"
                placeholder="+998 90 123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                label={s.pickupAddress}
                wrapperClassName="sm:col-span-2"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <Input
                label={s.lat}
                className="num"
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="40.0956"
              />
              <Input
                label={s.lng}
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
                  {s.useLocation}
                </Button>
                <p className="text-xs text-muted">
                  {s.locationHint}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title={s.tax} description={s.taxDescription} divider />
            <CardBody className="pt-4">
              <Input
                label={s.tin}
                inputMode="numeric"
                autoComplete="off"
                className="num"
                wrapperClassName="max-w-[16rem]"
                maxLength={9}
                placeholder="123456789"
                value={tin}
                onChange={(e) => setTin(e.target.value.replace(/\D/g, ''))}
                error={tinInvalid ?? undefined}
                hint={s.tinHint}
              />
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title={s.deliveryMethod} description={s.deliveryMethodDescription} divider />
            <CardBody className="pt-4">
              <RadioGroup<DeliveryMode>
                name="deliveryMode"
                options={deliveryOptions()}
                value={deliveryMode}
                onChange={setDeliveryMode}
                orientation="horizontal"
              />
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title={s.hours} description={s.hoursDescription} divider />
            <CardBody className="flex flex-wrap gap-4 pt-4">
              <Input
                label={s.opens}
                type="time"
                className="num"
                wrapperClassName="w-36"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <Input
                label={s.closes}
                type="time"
                className="num"
                wrapperClassName="w-36"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title={s.stockAlert} divider />
            <CardBody className="pt-4">
              <Input
                label={s.threshold}
                type="number"
                className="num"
                wrapperClassName="max-w-[12rem]"
                min={0}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                hint={s.thresholdHint}
              />
            </CardBody>
          </Card>

          {/* Yopishqoq saqlash paneli: uzun formada tugma doim qo'l ostida. */}
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex max-w-3xl items-center justify-end gap-3">
              <p className="mr-auto text-[13px] text-muted" aria-live="polite">
                {dirty ? s.dirty : s.clean}
              </p>
              <Button type="submit" isLoading={saving} disabled={!dirty && !saving} leftIcon={<Check size={14} aria-hidden />}>
                {m.common.save}
              </Button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
