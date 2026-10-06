'use client';

import { useEffect, useMemo, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  adsApi,
  foodAdminApi,
  marketAdminApi,
  type AdBanner,
  type AdLinkType,
} from '@/lib/api';
import {
  AD_IMAGE_TYPES,
  AD_LINK_LABELS,
  buildAdFormData,
  validateAdForm,
  type AdFormErrors,
  type AdFormInput,
} from '@/lib/ads';

const EMPTY_FORM: AdFormInput = {
  title: '',
  linkType: 'none',
  linkTarget: '',
  startsAt: '',
  endsAt: '',
  sortOrder: '0',
  isActive: true,
  image: null,
};

interface VendorOption {
  id: string;
  name: string;
}

interface CreateAdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ad: AdBanner) => void;
}

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
    ?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || "Bannerni saqlab bo'lmadi";
}

export function CreateAdDialog({ open, onOpenChange, onCreated }: CreateAdDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<AdFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<AdFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<Record<'restaurant' | 'store', VendorOption[] | null>>({
    restaurant: null,
    store: null,
  });

  const previewUrl = useMemo(() => (form.image ? URL.createObjectURL(form.image) : null), [form.image]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setErrors({});
    }
  }, [open]);

  // Sotuvchilar ro'yxati faqat shu havola turi tanlanganda, bir marta yuklanadi.
  useEffect(() => {
    const kind = form.linkType;
    if ((kind !== 'restaurant' && kind !== 'store') || vendors[kind]) return;
    const load = kind === 'restaurant' ? foodAdminApi.getAll() : marketAdminApi.getAll();
    load
      .then((res) =>
        setVendors((prev) => ({
          ...prev,
          [kind]: res.data.data
            .filter((v) => v.status === 'active')
            .map((v) => ({ id: v.id, name: v.name })),
        }))
      )
      .catch(() =>
        toast({ title: 'Xatolik', description: "Sotuvchilar ro'yxatini yuklab bo'lmadi", variant: 'error' })
      );
  }, [form.linkType, vendors, toast]);

  const update = <K extends keyof AdFormInput>(key: K, value: AdFormInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateAdForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const res = await adsApi.create(buildAdFormData(form));
      onCreated(res.data.data);
      toast({ title: 'Banner qo\'shildi', description: res.data.data.title, variant: 'success' });
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const vendorKind = form.linkType === 'restaurant' || form.linkType === 'store' ? form.linkType : null;
  const vendorOptions = vendorKind ? vendors[vendorKind] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yangi banner</DialogTitle>
          <DialogDescription>
            Yo&apos;lovchi ilovasining bosh ekranidagi karuselda ko&apos;rinadi. Rasm keyin
            o&apos;zgarmaydi — boshqa rasm uchun yangi banner yarating.
          </DialogDescription>
        </DialogHeader>

        <form id="create-ad-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <span className="mb-1.5 block text-caption font-medium text-muted">Rasm (2:1, ≤ 2 MB)</span>
            <label
              className="flex aspect-[2/1] w-full cursor-pointer items-center justify-center overflow-hidden rounded-ds-md border border-dashed border-line-strong bg-surface-2 text-muted transition-colors duration-fast hover:border-primary focus-within:ring-2 focus-within:ring-focus"
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Tanlangan rasm" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-caption">
                  <ImagePlus className="h-6 w-6" aria-hidden="true" />
                  JPEG, PNG yoki WEBP tanlang
                </span>
              )}
              <input
                type="file"
                accept={AD_IMAGE_TYPES.join(',')}
                className="sr-only"
                onChange={(e) => update('image', e.target.files?.[0] ?? null)}
              />
            </label>
            {errors.image && (
              <p className="mt-1.5 text-caption text-danger-deep dark:text-danger-light">{errors.image}</p>
            )}
          </div>

          <Input
            label="Nomi (faqat admin uchun)"
            value={form.title}
            maxLength={120}
            onChange={(e) => update('title', e.target.value)}
            error={errors.title}
            placeholder="Masalan: Lavash Center — oktyabr aksiyasi"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-caption font-medium text-muted">Bosilganda</span>
              <Select
                value={form.linkType}
                onValueChange={(v) => {
                  update('linkType', v as AdLinkType);
                  update('linkTarget', '');
                }}
              >
                <SelectTrigger aria-label="Havola turi">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(AD_LINK_LABELS) as AdLinkType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {AD_LINK_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.linkType === 'url' && (
              <Input
                label="Havola"
                value={form.linkTarget}
                onChange={(e) => update('linkTarget', e.target.value)}
                error={errors.linkTarget}
                placeholder="https://..."
                inputMode="url"
              />
            )}

            {vendorKind && (
              <div>
                <span className="mb-1.5 block text-caption font-medium text-muted">
                  {AD_LINK_LABELS[vendorKind]}
                </span>
                <Select value={form.linkTarget} onValueChange={(v) => update('linkTarget', v)}>
                  <SelectTrigger aria-label={AD_LINK_LABELS[vendorKind]} disabled={!vendorOptions}>
                    <SelectValue placeholder={vendorOptions ? 'Tanlang' : 'Yuklanmoqda…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(vendorOptions ?? []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.linkTarget && (
                  <p className="mt-1.5 text-caption text-danger-deep dark:text-danger-light">
                    {errors.linkTarget}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="datetime-local"
              label="Boshlanishi"
              hint="Bo'sh — darhol"
              value={form.startsAt}
              onChange={(e) => update('startsAt', e.target.value)}
              error={errors.startsAt}
            />
            <Input
              type="datetime-local"
              label="Tugashi"
              hint="Bo'sh — muddatsiz"
              value={form.endsAt}
              onChange={(e) => update('endsAt', e.target.value)}
              error={errors.endsAt}
            />
          </div>

          <div className="grid items-end gap-4 sm:grid-cols-2">
            <Input
              type="number"
              mono
              min={0}
              max={1000}
              label="Tartib"
              hint="Kichigi oldinda"
              value={form.sortOrder}
              onChange={(e) => update('sortOrder', e.target.value)}
              error={errors.sortOrder}
            />
            <div className="flex items-center gap-3 pb-7">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => update('isActive', v)}
                aria-label="Banner yoqilgan"
              />
              <span className="text-body text-ink">{form.isActive ? 'Yoqilgan' : "O'chirilgan"}</span>
            </div>
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button type="submit" form="create-ad-form" isLoading={saving}>
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
