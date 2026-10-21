'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Notice } from '@/components/settings/Notice';
import { useResource } from '@/hooks/useResource';
import { financeSettingsApi, type WalletTopupSettings } from '@/lib/compliance-api';
import {
  apiErrorMessage,
  MANUAL_ADJUSTMENT_LIMIT_MAX,
  normalizePresets,
  TOPUP_HOLD_DAYS_MAX,
  TOPUP_MAX_PRESETS,
  validateTopupSettings,
  type TopupErrors,
} from '@/lib/compliance';
import { formatMoney } from '@/lib/format';
import { t } from '@/locales';

interface Form {
  enabled: boolean;
  min: string;
  max: string;
  presets: number[];
  /** Bo'sh — backend bu maydonni bermagan (eski versiya); yuborilmaydi. */
  holdDays: string;
  managerLimit: string;
}

const toForm = (s: WalletTopupSettings): Form => ({
  enabled: s.walletTopupEnabled,
  min: String(s.walletTopupMin),
  max: String(s.walletTopupMax),
  presets: normalizePresets(s.walletTopupPresets),
  holdDays: s.walletTopupHoldDays === undefined ? '' : String(s.walletTopupHoldDays),
  managerLimit: s.manualAdjustmentManagerLimit === undefined ? '' : String(s.manualAdjustmentManagerLimit),
});

/** Bo'sh qoldirilgan ixtiyoriy maydon PATCH ga kirmaydi. */
const optionalNumber = (value: string): number | undefined => (value.trim() === '' ? undefined : Number(value));

const toValues = (f: Form) => ({
  walletTopupMin: Number(f.min),
  walletTopupMax: Number(f.max),
  walletTopupPresets: f.presets,
  walletTopupHoldDays: optionalNumber(f.holdDays),
  manualAdjustmentManagerLimit: optionalNumber(f.managerLimit),
});

/** Hamyonni Payme/Click/UZPS orqali o'zi to'ldirish — LEGAL-COMPLIANCE §11. */
export function WalletTopupCard() {
  const m = t();
  const f = m.finance.walletTopup;
  const { toast } = useToast();
  const res = useResource(
    () => financeSettingsApi.getWalletTopup().then((r) => r.data.data),
    f.loadError
  );
  const [form, setForm] = useState<Form | null>(null);
  const [newPreset, setNewPreset] = useState('');
  const [errors, setErrors] = useState<TopupErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (res.data) setForm(toForm(res.data));
  }, [res.data]);

  const saved = res.data ? toForm(res.data) : null;
  const dirty =
    !!form &&
    !!saved &&
    (form.enabled !== saved.enabled ||
      form.min !== saved.min ||
      form.max !== saved.max ||
      form.holdDays !== saved.holdDays ||
      form.managerLimit !== saved.managerLimit ||
      form.presets.join(',') !== saved.presets.join(','));

  const update = (patch: Partial<Form>) => {
    if (!form) return;
    const next = { ...form, ...patch };
    setForm(next);
    if (Object.keys(errors).length > 0) setErrors(validateTopupSettings(toValues(next)));
  };

  const addPreset = () => {
    if (!form) return;
    const value = Number(newPreset);
    if (!Number.isInteger(value) || value <= 0) return;
    update({ presets: normalizePresets([...form.presets, value]) });
    setNewPreset('');
  };

  const save = async () => {
    if (!form) return;
    const errs = validateTopupSettings(toValues(form));
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      const r = await financeSettingsApi.updateWalletTopup({ walletTopupEnabled: form.enabled, ...toValues(form) });
      res.setData(r.data.data);
      toast({ title: m.finance.saved, description: f.savedDesc, variant: 'success' });
    } catch (err) {
      toast({ title: m.common.error, description: apiErrorMessage(err, m.common.saveError), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title={f.title}
      description={f.description}
      badge={
        res.data ? (
          <Badge variant={res.data.walletTopupEnabled ? 'success' : 'neutral'} dot={res.data.walletTopupEnabled}>
            {res.data.walletTopupEnabled ? m.finance.enabled : m.finance.disabled}
          </Badge>
        ) : null
      }
      loading={res.loading}
      error={res.error}
      hasLoaded={res.hasLoaded && !!form}
      onRetry={res.reload}
      dirty={dirty}
      saving={saving}
      onReset={() => {
        if (saved) setForm(saved);
        setErrors({});
      }}
      onSave={save}
    >
      {form && (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-ink">{f.buttonToggle}</p>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => update({ enabled: v })}
              aria-label={f.toggleAria}
            />
          </div>
          {form.enabled && !saved?.enabled && (
            <Notice>{f.keysNotice}</Notice>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={f.minLabel}
              type="number"
              inputMode="numeric"
              step={1000}
              value={form.min}
              error={errors.walletTopupMin}
              onChange={(e) => update({ min: e.target.value })}
            />
            <Input
              label={f.maxLabel}
              type="number"
              inputMode="numeric"
              step={1000}
              value={form.max}
              error={errors.walletTopupMax}
              onChange={(e) => update({ max: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={f.holdLabel}
              type="number"
              inputMode="numeric"
              min={0}
              max={TOPUP_HOLD_DAYS_MAX}
              step={1}
              value={form.holdDays}
              error={errors.walletTopupHoldDays}
              hint={f.holdHint}
              onChange={(e) => update({ holdDays: e.target.value })}
            />
            <Input
              label={f.managerLimitLabel}
              type="number"
              inputMode="numeric"
              min={0}
              max={MANUAL_ADJUSTMENT_LIMIT_MAX}
              step={100000}
              value={form.managerLimit}
              error={errors.manualAdjustmentManagerLimit}
              hint={f.managerLimitHint(formatMoney(MANUAL_ADJUSTMENT_LIMIT_MAX))}
              onChange={(e) => update({ managerLimit: e.target.value })}
            />
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">
              {f.presets}{' '}
              <span className="font-normal text-muted">
                ({form.presets.length}/{TOPUP_MAX_PRESETS})
              </span>
            </p>
            <ul className="flex flex-wrap gap-2" aria-label={f.presets}>
              {form.presets.length === 0 && <li className="text-xs text-muted">{f.noPresets}</li>}
              {form.presets.map((p) => (
                <li
                  key={p}
                  className="inline-flex h-7 items-center gap-1 rounded-ds-sm border border-line bg-surface-2 pl-2.5 pr-1 text-[13px]"
                >
                  <span className="num">{formatMoney(p)}</span>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-ds-xs text-muted hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={f.removePreset(formatMoney(p))}
                    onClick={() => update({ presets: form.presets.filter((x) => x !== p) })}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-end gap-2">
              <Input
                label={f.newPresetLabel}
                type="number"
                inputMode="numeric"
                step={1000}
                value={newPreset}
                onChange={(e) => setNewPreset(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPreset();
                  }
                }}
                wrapperClassName="max-w-[200px]"
              />
              <Button
                variant="secondary"
                onClick={addPreset}
                disabled={!newPreset || form.presets.length >= TOPUP_MAX_PRESETS}
                leftIcon={<Plus size={14} aria-hidden="true" />}
              >
                {f.add}
              </Button>
            </div>
            {errors.walletTopupPresets && (
              <p className="mt-1.5 text-xs text-danger-dark dark:text-danger-light" role="alert">
                {errors.walletTopupPresets}
              </p>
            )}
          </div>
        </>
      )}
    </SettingsSection>
  );
}
