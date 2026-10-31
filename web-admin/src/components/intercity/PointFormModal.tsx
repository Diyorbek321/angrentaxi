'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Modal, useToast } from '@/components/ui';
import { apiErrorMessage, apiErrorTitle } from '@/lib/api-error';
import { intercityApi } from '@/lib/intercity-api';
import {
  parseOptionalPrice,
  validatePointForm,
  type FormErrors,
  type IntercityPoint,
  type IntercityPointForm,
} from '@/lib/intercity';
import { t } from '@/locales';

interface PointFormModalProps {
  open: boolean;
  /** `null` = yangi nuqta. */
  point: IntercityPoint | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

/** Maydonlar satr holida — foydalanuvchi "41," yozayotganda son NaN ga aylanmasin. */
interface Draft {
  name: string;
  centerLat: string;
  centerLng: string;
  radiusKm: string;
  extensionMaxKm: string;
  extensionPricePerKm: string;
  /** Bo'sh — Comfort ham Start narxida. */
  extensionComfortPricePerKm: string;
}

const EMPTY: Draft = {
  name: '',
  centerLat: '',
  centerLng: '',
  radiusKm: '5',
  extensionMaxKm: '0',
  extensionPricePerKm: '0',
  extensionComfortPricePerKm: '',
};

/** Bo'sh maydon 0 — "davom o'chiq" holati uchun admin hech narsa yozmaydi. */
const numberOrZero = (raw: string): number => (raw.trim() === '' ? 0 : Number(raw));

const toForm = (draft: Draft): IntercityPointForm => ({
  name: draft.name.trim(),
  centerLat: Number(draft.centerLat),
  centerLng: Number(draft.centerLng),
  radiusKm: Number(draft.radiusKm),
  extensionMaxKm: numberOrZero(draft.extensionMaxKm),
  extensionPricePerKm: numberOrZero(draft.extensionPricePerKm),
  extensionComfortPricePerKm: parseOptionalPrice(draft.extensionComfortPricePerKm),
});

export function PointFormModal({ open, point, onClose, onSaved }: PointFormModalProps) {
  const m = t();
  const fm = m.intercity.pointForm;
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<FormErrors<IntercityPointForm>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setDraft(
      point
        ? {
            name: point.name,
            centerLat: String(point.centerLat),
            centerLng: String(point.centerLng),
            radiusKm: String(point.radiusKm),
            extensionMaxKm: String(point.extensionMaxKm ?? 0),
            extensionPricePerKm: String(point.extensionPricePerKm ?? 0),
            extensionComfortPricePerKm:
              point.extensionComfortPricePerKm == null ? '' : String(point.extensionComfortPricePerKm),
          }
        : EMPTY
    );
  }, [open, point]);

  const update = (key: keyof Draft, value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (errors[key]) setErrors(validatePointForm(toForm(next)));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const form = toForm(draft);
    const found = validatePointForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      if (point) {
        await intercityApi.updatePoint(point.id, form);
        toast({ title: fm.updated, variant: 'success' });
      } else {
        await intercityApi.createPoint(form);
        toast({ title: fm.added, variant: 'success' });
      }
      onClose();
      await onSaved();
    } catch (err) {
      toast({
        title: apiErrorTitle(err, fm.saveFailed),
        description: apiErrorMessage(err, fm.saveError),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={point ? fm.editTitle : fm.newTitle}
      description={fm.description}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {m.common.cancel}
          </Button>
          <Button type="submit" form="intercity-point-form" isLoading={saving}>
            {point ? m.common.save : m.common.add}
          </Button>
        </>
      }
    >
      <form id="intercity-point-form" onSubmit={save} className="space-y-4" noValidate>
        <Input
          label={fm.name}
          placeholder={fm.namePlaceholder}
          value={draft.name}
          error={errors.name}
          onChange={(e) => update('name', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={fm.lat}
            inputMode="decimal"
            className="num"
            placeholder="41.0167"
            value={draft.centerLat}
            error={errors.centerLat}
            onChange={(e) => update('centerLat', e.target.value)}
          />
          <Input
            label={fm.lng}
            inputMode="decimal"
            className="num"
            placeholder="70.1436"
            value={draft.centerLng}
            error={errors.centerLng}
            onChange={(e) => update('centerLng', e.target.value)}
          />
        </div>
        <Input
          label={fm.radius}
          type="number"
          inputMode="decimal"
          min={0.5}
          max={50}
          step={0.5}
          value={draft.radiusKm}
          error={errors.radiusKm}
          hint={fm.radiusHint}
          onChange={(e) => update('radiusKm', e.target.value)}
          wrapperClassName="max-w-[12rem]"
        />
        <fieldset className="space-y-3 rounded-ds-sm border border-line bg-surface-2 p-3">
          <legend className="px-1 text-sm font-medium text-ink">{fm.extensionLegend}</legend>
          <p className="text-xs text-muted">
            {fm.extensionHint}
          </p>
          <Input
            label={fm.maxKm}
            type="number"
            inputMode="decimal"
            min={0}
            max={60}
            step={1}
            value={draft.extensionMaxKm}
            error={errors.extensionMaxKm}
            hint={fm.maxKmHint}
            onChange={(e) => update('extensionMaxKm', e.target.value)}
            wrapperClassName="max-w-[12rem]"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={fm.startPerKm}
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              className="num"
              value={draft.extensionPricePerKm}
              error={errors.extensionPricePerKm}
              onChange={(e) => update('extensionPricePerKm', e.target.value)}
            />
            <Input
              label={fm.comfortPerKm}
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              className="num"
              placeholder={fm.comfortPlaceholder}
              value={draft.extensionComfortPricePerKm}
              error={errors.extensionComfortPricePerKm}
              onChange={(e) => update('extensionComfortPricePerKm', e.target.value)}
            />
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
