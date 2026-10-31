'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import {
  getDriverLegal,
  updateDriverLegal,
  type DriverLegalSummary,
  type DriverProfile,
} from '@/lib/api';
import { apiErrorTitle } from '@/lib/api-error';
import {
  taxStatusLabels,
  taxStatusOptions,
  apiErrorMessage,
  buildLegalPatch,
  enforcementText,
  hasMaskedLegalIds,
  legalDuplicateMessages,
  legalDuplicateField,
  legalBadge,
  legalFormFromProfile,
  validateLegalForm,
  type LegalFormErrors,
  type LegalFormValues,
} from '@/lib/driver-legal';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonForm } from '@/components/ui/Skeleton';
import { KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { useToast } from '@/components/ui/Toast';
import { formatDate, fullName } from '@/lib/format';
import { isUzRegionCode, licenceRegionState, regionOptions } from '@/lib/uz-regions';
import { t } from '@/locales';

export interface DriverLegalDrawerProps {
  driver: DriverProfile | null;
  /** drivers_approve — tahrirlash; aks holda faqat ko'rish. */
  canEdit: boolean;
  onClose: () => void;
  /** Saqlangandan keyin jadvaldagi badge yangilanadi. */
  onUpdated?: (driverId: string, summary: DriverLegalSummary) => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * «Huquqiy profil» (VMQ 200 / PQ-247): profil, talablarga moslik sabablari
 * va majburlash holati. Tahrirlash — drivers_approve ruxsati bilan.
 */
export function DriverLegalDrawer({ driver, canEdit, onClose, onUpdated }: DriverLegalDrawerProps) {
  const m = t();
  const lg = m.drivers.legal;
  const { toast } = useToast();
  const [summary, setSummary] = useState<DriverLegalSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<LegalFormValues | null>(null);
  const [errors, setErrors] = useState<LegalFormErrors>({});
  const [saving, setSaving] = useState(false);

  const driverId = driver?.id ?? null;

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const result = await getDriverLegal(driverId);
      setSummary(result);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, t().drivers.legal.loadError));
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    setSummary(null);
    setEditing(false);
    setErrors({});
    setError(null);
    if (driverId) void load();
  }, [driverId, load]);

  const startEdit = () => {
    if (!summary) return;
    setValues(legalFormFromProfile(summary.profile));
    setErrors({});
    setEditing(true);
  };

  const set = <K extends keyof LegalFormValues>(key: K, value: LegalFormValues[K]) => {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const save = async () => {
    if (!driverId || !summary || !values) return;
    const found = validateLegalForm(values, todayIso(), summary.profile.taxiLicenceRegion);
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }
    const patch = buildLegalPatch(summary.profile, values);
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateDriverLegal(driverId, patch);
      setSummary(updated);
      setEditing(false);
      onUpdated?.(driverId, updated);
      toast({
        title: lg.saved,
        description: legalBadge(updated.eligibility).label,
        variant: 'success',
      });
    } catch (err) {
      // 409 LEGAL_PROFILE_DUPLICATE — xato tegishli maydon ostida, forma ochiq qoladi.
      const duplicate = legalDuplicateField(err);
      if (duplicate) setErrors((prev) => ({ ...prev, [duplicate]: legalDuplicateMessages()[duplicate] }));
      toast({
        title: apiErrorTitle(err, lg.saveError),
        description: duplicate
          ? legalDuplicateMessages()[duplicate]
          : apiErrorMessage(err, lg.saveErrorDesc),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Niqoblangan PINFL/STIR — ko'ruvchida DRIVERS_APPROVE yo'q (backend shunday
  // qaytaradi): profil faqat ko'rish uchun, niqobli qiymat hech qachon tahrirlanmaydi.
  const masked = summary ? hasMaskedLegalIds(summary.profile) : false;
  const editable = canEdit && !masked;

  const footer = !summary || !editable ? undefined : editing ? (
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>
          {m.common.cancel}
        </Button>
        <Button size="sm" onClick={() => void save()} isLoading={saving}>
          {m.common.save}
        </Button>
      </div>
    ) : (
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={startEdit}>
          {m.common.edit}
        </Button>
      </div>
    );

  return (
    <Drawer
      isOpen={!!driver}
      onClose={onClose}
      title={lg.title}
      subtitle={driver ? fullName(driver.firstName, driver.lastName) : undefined}
      width="lg"
      footer={footer}
    >
      {error && !summary ? (
        <ErrorState title={lg.loadError} message={error} onRetry={load} retrying={loading} />
      ) : !summary ? (
        <SkeletonForm fields={6} />
      ) : (
        <div className="space-y-5">
          <EligibilitySection summary={summary} />
          {editing && values && editable ? (
            <LegalForm values={values} errors={errors} onChange={set} />
          ) : (
            <ProfileView summary={summary} />
          )}
          {masked && (
            <p className="text-xs text-subtle">
              {lg.masked}
            </p>
          )}
          {!editable && (
            <p className="text-xs text-subtle">{lg.noEditPermission}</p>
          )}
        </div>
      )}
    </Drawer>
  );
}

function EligibilitySection({ summary }: { summary: DriverLegalSummary }) {
  const e = summary.eligibility;
  const badge = legalBadge(e);
  const lg = t().drivers.legal;
  return (
    <section aria-label={lg.eligibilityAria} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={badge.variant}
          size="lg"
          icon={
            badge.variant === 'success' ? (
              <CheckCircle2 size={13} aria-hidden />
            ) : badge.variant === 'danger' ? (
              <ShieldAlert size={13} aria-hidden />
            ) : undefined
          }
        >
          {badge.label}
        </Badge>
        <Badge variant={e.enforced ? 'danger' : 'neutral'} size="md">
          {e.enforced ? lg.enforced : lg.notEnforced}
        </Badge>
      </div>
      <p className="text-xs text-muted">{enforcementText(e, formatDate)}</p>
      {e.appliesToTaxi && e.reasons.length > 0 && (
        <ul className="space-y-1.5" aria-label={lg.issuesAria}>
          {e.reasons.map((r) => (
            <li
              key={r.code}
              className={`flex items-start gap-2 rounded-ds-sm border px-3 py-2 text-[13px] ${
                e.blocking
                  ? 'border-danger/30 bg-danger-tint text-danger-dark dark:text-danger-light'
                  : 'border-info/25 bg-info-tint text-info-dark dark:text-info-light'
              }`}
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <span className="sr-only">{e.blocking ? lg.blocks : lg.warning}</span>
                {r.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Bo'sh yoki eski erkin matn — hudud cheklovi ishlamaydi, ko'zga tashlansin. */
function LicenceRegionValue({ value }: { value: string | null }) {
  const lg = t().drivers.legal;
  const state = licenceRegionState(value);
  if (state.kind === 'ok') return <>{state.name}</>;
  return <Badge variant="muted-danger">{state.kind === 'missing' ? lg.regionMissing : lg.regionLegacy(state.text)}</Badge>;
}

/** Eski erkin matn ro'yxatda qoladi — saqlashda o'zgarmasa yuborilmaydi. */
function licenceRegionOptions(current: string) {
  const lg = t().drivers.legal;
  const legacy = current.trim() && !isUzRegionCode(current.trim()) ? current.trim() : null;
  return [
    { value: '', label: lg.regionNone },
    ...(legacy ? [{ value: legacy, label: lg.regionLegacyOption(legacy) }] : []),
    ...regionOptions(),
  ];
}

function ProfileView({ summary }: { summary: DriverLegalSummary }) {
  const p = summary.profile;
  const lg = t().drivers.legal;
  const dash = <span className="text-subtle">{t().lib.taxStatusNotSet}</span>;
  return (
    <KeyValueList>
      <KeyValue label={lg.taxStatus}>{p.taxStatus ? taxStatusLabels()[p.taxStatus] : dash}</KeyValue>
      <KeyValue label={lg.pinfl}>{p.pinfl ? <span className="font-mono">{p.pinfl}</span> : dash}</KeyValue>
      <KeyValue label={lg.tin}>{p.tin ? <span className="font-mono">{p.tin}</span> : dash}</KeyValue>
      <KeyValue label={lg.birthDate}>{p.birthDate ? formatDate(p.birthDate) : dash}</KeyValue>
      <KeyValue label={lg.licenceIssued}>
        {p.drivingLicenceIssuedAt ? formatDate(p.drivingLicenceIssuedAt) : dash}
      </KeyValue>
      <KeyValue label={lg.taxiLicence}>
        {p.taxiLicenceNumber ? <span className="font-mono">{p.taxiLicenceNumber}</span> : dash}
      </KeyValue>
      <KeyValue label={lg.licenceRegion}>
        <LicenceRegionValue value={p.taxiLicenceRegion} />
      </KeyValue>
      <KeyValue label={lg.citizenship}>{p.citizenship}</KeyValue>
    </KeyValueList>
  );
}

function LegalForm({
  values,
  errors,
  onChange,
}: {
  values: LegalFormValues;
  errors: LegalFormErrors;
  onChange: <K extends keyof LegalFormValues>(key: K, value: LegalFormValues[K]) => void;
}) {
  const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);
  const lg = t().drivers.legal;
  return (
    <form
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      onSubmit={(e) => e.preventDefault()}
      aria-label={lg.editAria}
      noValidate
    >
      <Select
        label={lg.taxStatus}
        options={taxStatusOptions()}
        value={values.taxStatus}
        onChange={(e) => onChange('taxStatus', e.target.value as LegalFormValues['taxStatus'])}
        error={errors.taxStatus}
        wrapperClassName="sm:col-span-2"
      />
      <Input
        label={lg.pinfl}
        inputMode="numeric"
        mono
        value={values.pinfl}
        onChange={(e) => onChange('pinfl', digits(e.target.value, 14))}
        error={errors.pinfl}
        hint={lg.pinflHint}
      />
      <Input
        label={lg.tin}
        inputMode="numeric"
        mono
        value={values.tin}
        onChange={(e) => onChange('tin', digits(e.target.value, 9))}
        error={errors.tin}
        hint={lg.tinHint}
      />
      <Input
        label={lg.birthDate}
        type="date"
        value={values.birthDate}
        onChange={(e) => onChange('birthDate', e.target.value)}
        error={errors.birthDate}
      />
      <Input
        label={lg.licenceIssuedDate}
        type="date"
        value={values.drivingLicenceIssuedAt}
        onChange={(e) => onChange('drivingLicenceIssuedAt', e.target.value)}
        error={errors.drivingLicenceIssuedAt}
        hint={lg.licenceHint}
      />
      <Input
        label={lg.taxiLicenceNumber}
        mono
        maxLength={50}
        value={values.taxiLicenceNumber}
        onChange={(e) => onChange('taxiLicenceNumber', e.target.value)}
        error={errors.taxiLicenceNumber}
      />
      <Select
        label={lg.licenceRegion}
        options={licenceRegionOptions(values.taxiLicenceRegion)}
        value={values.taxiLicenceRegion}
        onChange={(e) => onChange('taxiLicenceRegion', e.target.value)}
        error={errors.taxiLicenceRegion}
        hint={lg.regionHint}
      />
      <Input
        label={lg.citizenship}
        maxLength={2}
        value={values.citizenship}
        onChange={(e) => onChange('citizenship', e.target.value.toUpperCase())}
        error={errors.citizenship}
        hint={lg.citizenshipHint}
      />
    </form>
  );
}
