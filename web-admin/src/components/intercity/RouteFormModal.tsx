'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, useToast } from '@/components/ui';
import { apiErrorTitle, parseApiError } from '@/lib/api-error';
import { intercityApi } from '@/lib/intercity-api';
import {
  parseOptionalPrice,
  routeLabel,
  toRoutePayload,
  validateRouteForm,
  type FormErrors,
  type IntercityPoint,
  type IntercityRoute,
  type IntercityRouteForm,
} from '@/lib/intercity';

interface RouteFormModalProps {
  open: boolean;
  /** `null` = yangi yo'nalish. */
  route: IntercityRoute | null;
  points: readonly IntercityPoint[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

interface Draft {
  originPointId: string;
  destinationPointId: string;
  seatPrice: string;
  wholeCarPrice: string;
  comfortSeatPrice: string;
  comfortWholeCarPrice: string;
  seatsDefault: string;
}

const EMPTY: Draft = {
  originPointId: '',
  destinationPointId: '',
  seatPrice: '',
  wholeCarPrice: '',
  comfortSeatPrice: '',
  comfortWholeCarPrice: '',
  seatsDefault: '4',
};

const toForm = (draft: Draft): IntercityRouteForm => ({
  originPointId: draft.originPointId,
  destinationPointId: draft.destinationPointId,
  seatPrice: Number(draft.seatPrice),
  wholeCarPrice: Number(draft.wholeCarPrice),
  comfortSeatPrice: parseOptionalPrice(draft.comfortSeatPrice),
  comfortWholeCarPrice: parseOptionalPrice(draft.comfortWholeCarPrice),
  seatsDefault: Number(draft.seatsDefault),
});

const fromRoute = (route: IntercityRoute): Draft => ({
  originPointId: route.originPointId,
  destinationPointId: route.destinationPointId,
  seatPrice: String(route.seatPrice),
  wholeCarPrice: String(route.wholeCarPrice),
  comfortSeatPrice: route.comfortSeatPrice === null ? '' : String(route.comfortSeatPrice),
  comfortWholeCarPrice: route.comfortWholeCarPrice === null ? '' : String(route.comfortWholeCarPrice),
  seatsDefault: String(route.seatsDefault),
});

export function RouteFormModal({ open, route, points, onClose, onSaved }: RouteFormModalProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<FormErrors<IntercityRouteForm>>({});
  /** Server qaytargan `reasons[]` — forma qoidasidan o'tib ketgan holatlar uchun. */
  const [serverReasons, setServerReasons] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setServerReasons([]);
    setDraft(route ? fromRoute(route) : EMPTY);
  }, [open, route]);

  // Yangi yo'nalish faqat faol nuqtalardan tuziladi (backend nofaolni 400 bilan rad etadi).
  const pointOptions = points
    .filter((p) => p.isActive)
    .map((p) => ({ value: p.id, label: p.name }));

  const update = (key: keyof Draft, value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (errors[key]) setErrors(validateRouteForm(toForm(next)));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const form = toForm(draft);
    const found = validateRouteForm(form);
    setErrors(found);
    setServerReasons([]);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      if (route) {
        await intercityApi.updateRoute(route.id, toRoutePayload(form, 'update'));
        toast({ title: 'Yoʻnalish yangilandi', variant: 'success' });
      } else {
        await intercityApi.createRoute(form);
        toast({ title: 'Yoʻnalish qoʻshildi', variant: 'success' });
      }
      onClose();
      await onSaved();
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.reasons.length > 0) {
        setServerReasons(parsed.reasons.map((r) => r.message));
      } else {
        toast({
          title: apiErrorTitle(err, 'Saqlab boʻlmadi'),
          description: parsed.message ?? 'Yoʻnalishni saqlashda xatolik',
          variant: 'error',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="lg"
      title={route ? 'Yoʻnalishni tahrirlash' : 'Yangi yoʻnalish'}
      description="Har bir yoʻnalish bir tomonga: Angren → Toshkent va Toshkent → Angren alohida qoʻshiladi."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="intercity-route-form" isLoading={saving}>
            {route ? 'Saqlash' : 'Qoʻshish'}
          </Button>
        </>
      }
    >
      <form id="intercity-route-form" onSubmit={save} className="space-y-4" noValidate>
        {route ? (
          // Uchlar o'zgarmaydi: boshqa uchlar — boshqa yo'nalish (backend PATCH ham qabul qilmaydi).
          <div className="rounded-ds-sm border border-line bg-surface-2 px-3 py-2">
            <p className="text-xs text-muted">Yoʻnalish</p>
            <p className="text-sm font-medium text-ink">{routeLabel(route)}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Qayerdan"
              placeholder="Nuqtani tanlang"
              options={pointOptions}
              value={draft.originPointId}
              error={errors.originPointId}
              onChange={(e) => update('originPointId', e.target.value)}
            />
            <Select
              label="Qayerga"
              placeholder="Nuqtani tanlang"
              options={pointOptions}
              value={draft.destinationPointId}
              error={errors.destinationPointId}
              onChange={(e) => update('destinationPointId', e.target.value)}
            />
          </div>
        )}

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-ink">Start</legend>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Oʻrindiq narxi, soʻm"
              type="number"
              inputMode="numeric"
              min={1}
              step={1000}
              placeholder="25000"
              value={draft.seatPrice}
              error={errors.seatPrice}
              onChange={(e) => update('seatPrice', e.target.value)}
            />
            <Input
              label="Butun mashina, soʻm"
              type="number"
              inputMode="numeric"
              min={1}
              step={1000}
              placeholder="100000"
              value={draft.wholeCarPrice}
              error={errors.wholeCarPrice}
              onChange={(e) => update('wholeCarPrice', e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-ink">Comfort</legend>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Oʻrindiq narxi, soʻm"
              type="number"
              inputMode="numeric"
              min={1}
              step={1000}
              placeholder="30000"
              value={draft.comfortSeatPrice}
              error={errors.comfortSeatPrice}
              onChange={(e) => update('comfortSeatPrice', e.target.value)}
            />
            <Input
              label="Butun mashina, soʻm"
              type="number"
              inputMode="numeric"
              min={1}
              step={1000}
              placeholder="120000"
              value={draft.comfortWholeCarPrice}
              error={errors.comfortWholeCarPrice}
              onChange={(e) => update('comfortWholeCarPrice', e.target.value)}
            />
          </div>
          <p className="text-xs text-muted">Ikkalasi boʻsh — bu yoʻnalishda Comfort yoʻq.</p>
        </fieldset>

        <Input
          label="Mashinadagi oʻrindiqlar"
          type="number"
          inputMode="numeric"
          min={1}
          max={8}
          step={1}
          value={draft.seatsDefault}
          error={errors.seatsDefault}
          hint="Haydovchi qatnov eʼlon qilganda shundan koʻp joy bera olmaydi."
          onChange={(e) => update('seatsDefault', e.target.value)}
          wrapperClassName="max-w-[12rem]"
        />

        {serverReasons.length > 0 && (
          <ul role="alert" className="space-y-1 rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2">
            {serverReasons.map((message) => (
              <li key={message} className="text-xs text-danger-dark dark:text-danger-light">
                {message}
              </li>
            ))}
          </ul>
        )}
      </form>
    </Modal>
  );
}
