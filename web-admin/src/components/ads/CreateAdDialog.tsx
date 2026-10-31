'use client';

import { useEffect, useMemo, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
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
  adLinkLabels,
  buildAdFormData,
  validateAdForm,
  type AdFormErrors,
  type AdFormInput,
} from '@/lib/ads';
import { t } from '@/locales';

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
  return message || t().ads.create.saveFailed;
}

export function CreateAdDialog({ open, onOpenChange, onCreated }: CreateAdDialogProps) {
  const m = t();
  const c = m.ads.create;
  const linkLabels = adLinkLabels();
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
        toast({ title: m.common.error, description: c.vendorsLoadFailed, variant: 'error' })
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
      toast({ title: c.added, description: res.data.data.title, variant: 'success' });
      onOpenChange(false);
    } catch (err) {
      toast({ title: m.common.error, description: errorMessage(err), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const vendorKind = form.linkType === 'restaurant' || form.linkType === 'store' ? form.linkType : null;
  const vendorOptions = vendorKind ? vendors[vendorKind] : null;

  const linkTypeOptions = (Object.keys(linkLabels) as AdLinkType[]).map((type) => ({
    value: type,
    label: linkLabels[type],
  }));

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      size="lg"
      title={c.title}
      description={c.description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {m.common.cancel}
          </Button>
          <Button type="submit" form="create-ad-form" isLoading={saving}>
            {m.common.save}
          </Button>
        </>
      }
    >
      <form id="create-ad-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field id="ad-image" label={c.image} error={errors.image}>
          <label
            className="flex aspect-[2/1] w-full cursor-pointer items-center justify-center overflow-hidden rounded-ds-md border border-dashed border-line-strong bg-surface-2 text-muted transition-colors hover:border-primary focus-within:ring-2 focus-within:ring-focus"
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={c.imageAlt} className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-xs">
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
                {c.imagePick}
              </span>
            )}
            <input
              id="ad-image"
              type="file"
              accept={AD_IMAGE_TYPES.join(',')}
              className="sr-only"
              onChange={(e) => update('image', e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>

        <Input
          label={c.name}
          value={form.title}
          maxLength={120}
          onChange={(e) => update('title', e.target.value)}
          error={errors.title}
          placeholder={c.namePlaceholder}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={c.onClick}
            options={linkTypeOptions}
            value={form.linkType}
            onChange={(e) => {
              update('linkType', e.target.value as AdLinkType);
              update('linkTarget', '');
            }}
          />

          {form.linkType === 'url' && (
            <Input
              label={c.link}
              value={form.linkTarget}
              onChange={(e) => update('linkTarget', e.target.value)}
              error={errors.linkTarget}
              placeholder="https://..."
              inputMode="url"
            />
          )}

          {vendorKind && (
            <Select
              label={linkLabels[vendorKind]}
              options={(vendorOptions ?? []).map((v) => ({ value: v.id, label: v.name }))}
              placeholder={vendorOptions ? c.pick : m.common.loading}
              disabled={!vendorOptions}
              value={form.linkTarget}
              onChange={(e) => update('linkTarget', e.target.value)}
              error={errors.linkTarget}
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="datetime-local"
            label={c.startsAt}
            hint={c.startsAtHint}
            value={form.startsAt}
            onChange={(e) => update('startsAt', e.target.value)}
            error={errors.startsAt}
          />
          <Input
            type="datetime-local"
            label={c.endsAt}
            hint={c.endsAtHint}
            value={form.endsAt}
            onChange={(e) => update('endsAt', e.target.value)}
            error={errors.endsAt}
          />
        </div>

        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Input
            type="number"
            min={0}
            max={1000}
            label={c.sortOrder}
            hint={c.sortOrderHint}
            value={form.sortOrder}
            onChange={(e) => update('sortOrder', e.target.value)}
            error={errors.sortOrder}
          />
          <div className="sm:pt-7">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => update('isActive', v)}
              label={form.isActive ? c.on : c.off}
              aria-label={c.activeAria}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
