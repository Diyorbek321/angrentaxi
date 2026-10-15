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
  const e: Errors = {};
  if (f.enforce && !isIsoDate(f.enforceDate)) e.enforceDate = 'Sanani kiriting';
  if (!intIn(f.minAge, 18, 70)) e.minAge = '18 dan 70 gacha butun son';
  if (!intIn(f.experience, 0, 30)) e.experience = '0 dan 30 gacha butun son';
  if (!intIn(f.vehicleAge, 1, 50)) e.vehicleAge = '1 dan 50 gacha butun son';
  const rate = Number(f.taxRate);
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(f.taxRate.trim()) || rate > 100) {
    e.taxRate = '0 dan 100 gacha, koʻpi bilan 2 kasr xona';
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

const PHASE_BADGE: Record<EnforcementPhase, { label: string; variant: 'neutral' | 'info' | 'danger' }> = {
  off: { label: 'Majburlanmaydi', variant: 'neutral' },
  grace: { label: 'Muhlat davri', variant: 'info' },
  enforced: { label: 'Majburlanmoqda', variant: 'danger' },
};

function EnforcementNotice({ phase, date }: { phase: EnforcementPhase; date: string }) {
  if (phase === 'off') {
    return (
      <Notice tone="neutral">
        Talablar majburlanmaydi: yetishmayotgan maʼlumotlar haydovchi ilovasida faqat ogohlantirish sifatida koʻrinadi.
      </Notice>
    );
  }
  const consequence =
    'talablarga javob bermaydigan haydovchi taksi uchun onlayn chiqa olmaydi va «Taksi» xizmatini yoqa olmaydi. Kuryer va yuk tashuvchi bloklanmaydi — taksi va kuryer ikkalasi yoqilgan haydovchi taksini oʻchirib, kuryer sifatida ishlashni davom ettirishi mumkin.';
  if (phase === 'grace') {
    return (
      <Notice tone="info" title={`Muhlat: ${date} gacha`}>
        Haydovchilar maʼlumotlarini toʻldirishga ulguradi. Shu kundan {consequence}
      </Notice>
    );
  }
  return (
    <Notice tone="danger" title="Talablar majburlanmoqda">
      Hozirdan {consequence}
    </Notice>
  );
}

export default function LegalCompliancePage() {
  const { toast } = useToast();
  const res = useResource(
    () => financeSettingsApi.getLegalCompliance().then((r) => r.data.data),
    'Huquqiy talablar sozlamalarini yuklab boʻlmadi.'
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
      toast({ title: 'Saqlandi', description: 'Huquqiy talablar sozlamalari yangilandi.', variant: 'success' });
      setConfirming(false);
    } catch (err) {
      toast({ title: 'Xatolik', description: apiErrorMessage(err, 'Saqlashda xatolik'), variant: 'error' });
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
        title="Huquqiy talablar"
        description="VMQ 200 haydovchi talablari, 1% soliqni ushlab qolish (PQ-247) va platforma STIR'i"
      />
      <div className="max-w-3xl space-y-4">
        <SettingsSection
          title="Haydovchi talablari va soliq"
          description="Standart holatda hech narsa majburlanmaydi va soliq ushlanmaydi."
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
                      Talablarni majburlash (taksi)
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Kelajak sana — muhlat davri; oʻtgan sana — darhol majburlanadi.
                    </p>
                  </div>
                  <Switch
                    checked={form.enforce}
                    onCheckedChange={(v) => update({ enforce: v })}
                    tone="danger"
                    aria-label="Talablarni majburlash"
                  />
                </div>
                {form.enforce && (
                  <Input
                    label="Majburlash sanasi (Toshkent, 00:00 dan)"
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
                  label="Minimal yosh"
                  type="number"
                  inputMode="numeric"
                  value={form.minAge}
                  error={errors.minAge}
                  hint="VMQ 200: 21"
                  onChange={(e) => update({ minAge: e.target.value })}
                />
                <Input
                  label="Haydash staji, yil"
                  type="number"
                  inputMode="numeric"
                  value={form.experience}
                  error={errors.experience}
                  hint="B toifasi, VMQ 200: 3"
                  onChange={(e) => update({ experience: e.target.value })}
                />
                <Input
                  label="Mashina yoshi, max yil"
                  type="number"
                  inputMode="numeric"
                  value={form.vehicleAge}
                  error={errors.vehicleAge}
                  hint="Shahar ichida, VMQ 200: 15"
                  onChange={(e) => update({ vehicleAge: e.target.value })}
                />
              </div>

              <section className="space-y-3 border-t border-line pt-4" aria-labelledby="tax-title">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p id="tax-title" className="text-sm font-medium text-ink">
                      Aylanma soligʻini ushlab qolish
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Har yakunlangan safar/yetkazishdan (yakuniy narx) haydovchi hamyonidan ushlanadi. Smena yoki
                      aksiya uni oʻchirmaydi.
                    </p>
                  </div>
                  <Switch
                    checked={form.taxEnabled}
                    onCheckedChange={(v) => update({ taxEnabled: v })}
                    aria-label="Soliqni ushlab qolish"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Stavka, %"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={form.taxRate}
                    error={errors.taxRate}
                    hint="PQ-247: 1%"
                    onChange={(e) => update({ taxRate: e.target.value })}
                  />
                  <Input
                    label="Platforma STIR'i"
                    inputMode="numeric"
                    mono
                    maxLength={9}
                    placeholder="9 ta raqam"
                    value={form.platformTin}
                    error={errors.platformTin}
                    hint="Smena fiskal yozuvida sotuvchi sifatida. Boʻsh — kiritilmagan."
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
        title="Oʻzgarishlarni tasdiqlash"
        confirmLabel="Saqlash"
        description={
          <ul className="list-disc space-y-1.5 pl-4">
            {becomesEnforced && (
              <li>
                Talablar <strong>darhol</strong> majburlanadi: javob bermaydigan haydovchilar taksi uchun onlayn chiqa
                olmaydi.
              </li>
            )}
            {taxChanged && form && (
              <li>
                {form.taxEnabled
                  ? `Keyingi yakunlangan safarlardan ${form.taxRate}% soliq haydovchi hamyonidan ushlanadi.`
                  : 'Soliq ushlab qolish toʻxtatiladi — platforma soliq agenti majburiyatini qoʻlda bajaradi.'}
              </li>
            )}
          </ul>
        }
      />
    </div>
  );
}
