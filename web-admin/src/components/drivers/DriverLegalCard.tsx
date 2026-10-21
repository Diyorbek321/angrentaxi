'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { DetailCard, KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { SkeletonText } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useResource } from '@/hooks/useResource';
import { driverLegalApi, type DriverLegalSummary } from '@/lib/compliance-api';
import { apiErrorMessage, tashkentToday } from '@/lib/compliance';
import { apiErrorTitle } from '@/lib/api-error';
import {
  buildDriverLegalPatch,
  hasMaskedLegalIds,
  legalDuplicateField,
  legalDuplicateMessage,
  taxStatusLabels,
  toDriverLegalForm,
  validateDriverLegalForm,
  type DriverLegalErrors,
  type DriverLegalForm,
} from '@/lib/driver-legal';
import { formatDateShort } from '@/lib/format';
import { DriverLegalModal } from './DriverLegalModal';
import { t } from '@/locales';

const Mono = ({ value }: { value: string | null }) =>
  value ? <span className="font-mono text-xs">{value}</span> : <span className="text-subtle">—</span>;

function EligibilityBadge({ e }: { e: DriverLegalSummary['eligibility'] }) {
  const m = t().drivers.legal.card;
  if (e.eligible) {
    return (
      <Badge variant="success" dot>
        {m.eligible}
      </Badge>
    );
  }
  return (
    <Badge variant={e.blocking ? 'danger' : 'neutral'} dot>
      {e.blocking ? m.taxiBlocked : m.notEligible}
    </Badge>
  );
}

function enforcementText(e: DriverLegalSummary['eligibility']): string {
  const m = t().drivers.legal.card;
  if (e.enforced) return m.enforced;
  if (e.enforcedFrom) return m.enforcedFrom(formatDateShort(e.enforcedFrom));
  return m.notEnforced;
}

/** VMQ 200 / PQ-247 huquqiy profili — `GET/PATCH /drivers/:id/legal`. */
export function DriverLegalCard({ driverId }: { driverId: string }) {
  const { toast } = useToast();
  const m = t().drivers.legal.card;
  const mc = t().common;
  const res = useResource(
    () => driverLegalApi.get(driverId).then((r) => r.data.data),
    m.loadError,
    [driverId]
  );
  const [form, setForm] = useState<DriverLegalForm | null>(null);
  const [errors, setErrors] = useState<DriverLegalErrors>({});
  const [saving, setSaving] = useState(false);

  const summary = res.data;

  const openEdit = () => {
    if (!summary) return;
    setForm(toDriverLegalForm(summary.profile));
    setErrors({});
  };

  const update = (patch: Partial<DriverLegalForm>) => {
    if (!form) return;
    const next = { ...form, ...patch };
    setForm(next);
    if (Object.keys(errors).length > 0) setErrors(validateDriverLegalForm(next, tashkentToday()));
  };

  const save = async () => {
    if (!form || !summary) return;
    const errs = validateDriverLegalForm(form, tashkentToday());
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const patch = buildDriverLegalPatch(form, summary.profile);
    if (Object.keys(patch).length === 0) {
      setForm(null);
      return;
    }
    setSaving(true);
    try {
      const r = await driverLegalApi.update(driverId, patch);
      res.setData(r.data.data);
      setForm(null);
      toast({ title: m.updated, variant: 'success' });
    } catch (err) {
      // 409 LEGAL_PROFILE_DUPLICATE — xato tegishli maydon ostida, forma ochiq qoladi.
      const duplicate = legalDuplicateField(err);
      if (duplicate) setErrors((prev) => ({ ...prev, [duplicate]: legalDuplicateMessage(duplicate) }));
      toast({
        title: apiErrorTitle(err, mc.error),
        description: duplicate ? legalDuplicateMessage(duplicate) : apiErrorMessage(err, mc.saveError),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Niqoblangan PINFL/STIR = DRIVERS_APPROVE yo'q: PATCH ham ruxsat etilmaydi,
  // shuning uchun tahrirlash tugmasi ko'rsatilmaydi (§25 #2).
  const masked = summary ? hasMaskedLegalIds(summary.profile) : false;
  const actions = summary && !masked ? (
    <Button variant="ghost" size="icon-sm" aria-label={m.editAria} onClick={openEdit}>
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  ) : null;

  return (
    <>
      <DetailCard title={m.title} actions={actions}>
        {!summary && res.error && !res.loading ? (
          <ErrorState message={res.error} onRetry={res.reload} compact />
        ) : !summary ? (
          <SkeletonText lines={6} />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <EligibilityBadge e={summary.eligibility} />
              <span className="text-xs text-muted">{enforcementText(summary.eligibility)}</span>
            </div>
            {summary.eligibility.reasons.length > 0 && (
              <ul className="space-y-1 rounded-ds-sm border border-line bg-surface-2 px-3 py-2 text-xs text-ink">
                {summary.eligibility.reasons.map((r) => (
                  <li key={r.code} className="flex gap-1.5">
                    <span aria-hidden="true" className="text-subtle">•</span>
                    <span>{r.message}</span>
                  </li>
                ))}
              </ul>
            )}
            {masked && (
              <p className="text-xs text-muted">
                {m.masked}
              </p>
            )}
            <KeyValueList>
              <KeyValue label={m.taxStatus}>
                {summary.profile.taxStatus ? taxStatusLabels()[summary.profile.taxStatus] : '—'}
              </KeyValue>
              <KeyValue label={m.pinfl}>
                <Mono value={summary.profile.pinfl} />
              </KeyValue>
              <KeyValue label={m.tin}>
                <Mono value={summary.profile.tin} />
              </KeyValue>
              <KeyValue label={m.birthDate}>
                <span className="num">{formatDateShort(summary.profile.birthDate)}</span>
              </KeyValue>
              <KeyValue label={m.licenceIssued}>
                <span className="num">{formatDateShort(summary.profile.drivingLicenceIssuedAt)}</span>
              </KeyValue>
              <KeyValue label={m.taxiLicence}>
                <Mono value={summary.profile.taxiLicenceNumber} />
              </KeyValue>
              <KeyValue label={m.licenceRegion}>{summary.profile.taxiLicenceRegion || '—'}</KeyValue>
              <KeyValue label={m.citizenship}>{summary.profile.citizenship || '—'}</KeyValue>
            </KeyValueList>
          </div>
        )}
      </DetailCard>

      <DriverLegalModal
        form={form}
        errors={errors}
        saving={saving}
        onChange={update}
        onClose={() => setForm(null)}
        onSave={save}
      />
    </>
  );
}
