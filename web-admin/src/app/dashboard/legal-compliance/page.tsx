'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { Notice } from '@/components/settings/Notice';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { useResource } from '@/hooks/useResource';
import { financeSettingsApi, type LegalComplianceSettings } from '@/lib/compliance-api';
import {
  apiErrorMessage,
  enforcementPhase,
  isIsoDate,
  isoToTashkentDate,
  tashkentDateToIso,
  validateOptionalTin,
  type EnforcementPhase,
} from '@/lib/compliance';
import { formatDateShort } from '@/lib/format';
import { t } from '@/locales';

interface Form {
  enforce: boolean;
  enforceDate: string;
  minAge: string;
  experience: string;
  vehicleAge: string;
  taxEnabled: boolean;
  taxRate: string;
  platformTin: string;
}

type Errors = Partial<Record<keyof Form, string>>;

const toForm = (s: LegalComplianceSettings): Form => ({
  enforce: s.legalComplianceEnforcedFrom !== null,
  enforceDate: isoToTashkentDate(s.legalComplianceEnforcedFrom),
  minAge: String(s.minDriverAgeYears),
  experience: String(s.minLicenceExperienceYears),
  vehicleAge: String(s.maxVehicleAgeYears),
  taxEnabled: s.taxWithholdingEnabled,
  taxRate: String(s.driverTaxWithholdingRate),
  platformTin: s.platformTin ?? '',
});

const intIn = (v: string, min: number, max: number) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n >= min && n <= max;
};

function validate(f: Form): Errors {
  const m = t();
  const v = m.compliance.legal.validation;
  const e: Errors = {};
  if (f.enforce && !isIsoDate(f.enforceDate)) e.enforceDate = m.finance.enterDate;
  if (!intIn(f.minAge, 18, 70)) e.minAge = v.intRange(18, 70);
  if (!intIn(f.experience, 0, 30)) e.experience = v.intRange(0, 30);
  if (!intIn(f.vehicleAge, 1, 50)) e.vehicleAge = v.intRange(1, 50);
  const rate = Number(f.taxRate);
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(f.taxRate.trim()) || rate > 100) {
    e.taxRate = v.taxRate;
  }
  const tinError = validateOptionalTin(f.platformTin);
  if (tinError) e.platformTin = tinError;
  return e;
}

const toDto = (f: Form): LegalComplianceSettings => ({
  legalComplianceEnforcedFrom: f.enforce ? tashkentDateToIso(f.enforceDate) : null,
  minDriverAgeYears: Number(f.minAge),
  minLicenceExperienceYears: Number(f.experience),
  maxVehicleAgeYears: Number(f.vehicleAge),
  taxWithholdingEnabled: f.taxEnabled,
  driverTaxWithholdingRate: Number(f.taxRate),
  platformTin: f.platformTin.trim() === '' ? null : f.platformTin.trim(),
});

const phaseBadge = (): Record<EnforcementPhase, { label: string; variant: 'neutral' | 'info' | 'danger' }> => {
  const p = t().compliance.legal.phase;
  return {
    off: { label: p.off, variant: 'neutral' },
    grace: { label: p.grace, variant: 'info' },
    enforced: { label: p.enforced, variant: 'danger' },
  };
};

function EnforcementNotice({ phase, date }: { phase: EnforcementPhase; date: string }) {
  const n = t().compliance.legal.notice;
  if (phase === 'off') {
    return (
      <Notice tone="neutral">
        {n.off}
      </Notice>
    );
  }
  const consequence = n.consequence;
  if (phase === 'grace') {
    return (
      <Notice tone="info" title={n.graceTitle(date)}>
        {n.graceBody} {consequence}
      </Notice>
    );
  }
  return (
    <Notice tone="danger" title={n.enforcedTitle}>
      {n.enforcedBody} {consequence}
    </Notice>
  );
}

export default function LegalCompliancePage() {
  const m = t();
  const l$ = m.compliance.legal;
  const PHASE_BADGE = phaseBadge();
  const { toast } = useToast();
  const res = useResource(
    () => financeSettingsApi.getLegalCompliance().then((r) => r.data.data),
    l$.loadError
  );
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (res.data) setForm(toForm(res.data));
  }, [res.data]);

  const saved = res.data ? toForm(res.data) : null;
  const dirty = !!form && !!saved && (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== saved[k]);

  const update = (patch: Partial<Form>) => {
    if (!form) return;
    const next = { ...form, ...patch };
    setForm(next);
    if (Object.keys(errors).length > 0) setErrors(validate(next));
  };

  const phase: EnforcementPhase =
    form && form.enforce && isIsoDate(form.enforceDate)
      ? enforcementPhase(tashkentDateToIso(form.enforceDate))
      : 'off';
  const savedPhase = enforcementPhase(res.data?.legalComplianceEnforcedFrom ?? null);
  const taxChanged = !!form && !!saved && (form.taxEnabled !== saved.taxEnabled || form.taxRate !== saved.taxRate);
  const becomesEnforced = phase === 'enforced' && savedPhase !== 'enforced';

  const persist = async () => {
    if (!form) return;
    setSaving(true);
    try {
      // Sana o'zgarmagan bo'lsa yuborilmaydi — kun aniqligidagi forma asl vaqtni yaxlitlab yubormasin.
      const { legalComplianceEnforcedFrom, ...rest } = toDto(form);
      const dateChanged = !saved || form.enforce !== saved.enforce || form.enforceDate !== saved.enforceDate;
      const r = await financeSettingsApi.updateLegalCompliance(
        dateChanged ? { ...rest, legalComplianceEnforcedFrom } : rest
      );
      res.setData(r.data.data);
      toast({ title: m.finance.saved, description: l$.savedDesc, variant: 'success' });
      setConfirming(false);
    } catch (err) {
      toast({ title: m.common.error, description: apiErrorMessage(err, m.common.saveError), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    if (!form) return;
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    // Pulga yoki haydovchi daromadiga bevosita taʼsir — aniq tasdiq.
    if (taxChanged || becomesEnforced) setConfirming(true);
    else void persist();
  };

  const dateLabel = form?.enforceDate ? formatDateShort(tashkentDateToIso(form.enforceDate)) : '';

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={l$.title}
        description={l$.description}
      />
      <div className="max-w-3xl space-y-4">
        <SettingsSection
          title={l$.sectionTitle}
          description={l$.sectionDesc}
          badge={
            res.data ? (
              <Badge variant={PHASE_BADGE[savedPhase].variant} dot>
                {PHASE_BADGE[savedPhase].label}
              </Badge>
            ) : null
          }
          loading={res.loading}
          error={res.error}
          hasLoaded={res.hasLoaded && !!form}
          onRetry={res.reload}
          skeletonFields={6}
          dirty={dirty}
          saving={saving && !confirming}
          onReset={() => {
            if (saved) setForm(saved);
            setErrors({});
          }}
          onSave={requestSave}
        >
          {form && (
            <>
              <section className="space-y-3" aria-labelledby="enforce-title">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p id="enforce-title" className="text-sm font-medium text-ink">
                      {l$.enforceTitle}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {l$.enforceHint}
                    </p>
                  </div>
                  <Switch
                    checked={form.enforce}
                    onCheckedChange={(v) => update({ enforce: v })}
                    tone="danger"
                    aria-label={l$.enforceAria}
                  />
                </div>
                {form.enforce && (
                  <Input
                    label={l$.enforceDateLabel}
                    type="date"
                    value={form.enforceDate}
                    error={errors.enforceDate}
                    onChange={(e) => update({ enforceDate: e.target.value })}
                    wrapperClassName="max-w-xs"
                  />
                )}
                <EnforcementNotice phase={phase} date={dateLabel} />
              </section>

              <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
                <Input
                  label={l$.minAge}
                  type="number"
                  inputMode="numeric"
                  value={form.minAge}
                  error={errors.minAge}
                  hint="VMQ 200: 21"
                  onChange={(e) => update({ minAge: e.target.value })}
                />
                <Input
                  label={l$.experience}
                  type="number"
                  inputMode="numeric"
                  value={form.experience}
                  error={errors.experience}
                  hint={l$.experienceHint}
                  onChange={(e) => update({ experience: e.target.value })}
                />
                <Input
                  label={l$.vehicleAge}
                  type="number"
                  inputMode="numeric"
                  value={form.vehicleAge}
                  error={errors.vehicleAge}
                  hint={l$.vehicleAgeHint}
                  onChange={(e) => update({ vehicleAge: e.target.value })}
                />
              </div>

              <section className="space-y-3 border-t border-line pt-4" aria-labelledby="tax-title">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p id="tax-title" className="text-sm font-medium text-ink">
                      {l$.taxTitle}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {l$.taxHint}
                    </p>
                  </div>
                  <Switch
                    checked={form.taxEnabled}
                    onCheckedChange={(v) => update({ taxEnabled: v })}
                    aria-label={l$.taxAria}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label={l$.rate}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={form.taxRate}
                    error={errors.taxRate}
                    hint="PQ-247: 1%"
                    onChange={(e) => update({ taxRate: e.target.value })}
                  />
                  <Input
                    label={l$.platformTin}
                    inputMode="numeric"
                    mono
                    maxLength={9}
                    placeholder={l$.tinPh}
                    value={form.platformTin}
                    error={errors.platformTin}
                    hint={l$.tinHint}
                    onChange={(e) => update({ platformTin: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
              </section>
            </>
          )}
        </SettingsSection>
      </div>

      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={persist}
        isPending={saving}
        tone={becomesEnforced ? 'danger' : 'default'}
        title={l$.confirmTitle}
        confirmLabel={m.common.save}
        description={
          <ul className="list-disc space-y-1.5 pl-4">
            {becomesEnforced && (
              <li>
                {l$.confirmEnforceBefore} <strong>{l$.confirmEnforceStrong}</strong> {l$.confirmEnforceAfter}
              </li>
            )}
            {taxChanged && form && (
              <li>
                {form.taxEnabled
                  ? l$.confirmTaxOn(form.taxRate)
                  : l$.confirmTaxOff}
              </li>
            )}
          </ul>
        }
      />
    </div>
  );
}
