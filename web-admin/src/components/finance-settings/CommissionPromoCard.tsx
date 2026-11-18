'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Notice } from '@/components/settings/Notice';
import { useResource } from '@/hooks/useResource';
import { financeSettingsApi } from '@/lib/compliance-api';
import {
  apiErrorMessage,
  isIsoDate,
  isoToTashkentDate,
  tashkentDateToIso,
  tashkentToday,
} from '@/lib/compliance';
import { formatDateShort } from '@/lib/format';
import { t } from '@/locales';

/** Komissiya: standart foiz (faqat ko'rish) + ishga tushirish aksiyasi (0% taksi). */
export function CommissionPromoCard() {
  const m = t();
  const f = m.finance.commission;
  const { toast } = useToast();
  const res = useResource(
    () => financeSettingsApi.getCommission().then((r) => r.data.data),
    f.loadError
  );
  const saved = res.data;
  const savedDate = isoToTashkentDate(saved?.launchPromoCommissionUntil);
  const [enabled, setEnabled] = useState(false);
  const [date, setDate] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setEnabled(savedDate !== '');
    setDate(savedDate);
    setFieldError(null);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reset, [savedDate]);

  const nextDate = enabled ? date : '';
  const dirty = nextDate !== savedDate;

  const validate = (): string | null => {
    if (!enabled) return null;
    if (!isIsoDate(date)) return m.finance.enterDate;
    if (date <= tashkentToday()) return f.endDateFuture;
    return null;
  };

  const requestSave = () => {
    const err = validate();
    setFieldError(err);
    if (!err) setConfirming(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await financeSettingsApi.setLaunchPromo(nextDate ? tashkentDateToIso(nextDate) : null);
      res.setData(r.data.data);
      toast({
        title: m.finance.saved,
        description: nextDate
          ? f.savedUntil(formatDateShort(tashkentDateToIso(nextDate)))
          : f.promoDisabled,
        variant: 'success',
      });
      setConfirming(false);
    } catch (err) {
      toast({ title: m.common.error, description: apiErrorMessage(err, m.common.saveError), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const badge = saved ? (
    saved.launchPromoActive ? (
      <Badge variant="success" dot>
        {f.promoActive}
      </Badge>
    ) : (
      <Badge variant="neutral">{f.noPromo}</Badge>
    )
  ) : null;

  return (
    <>
      <SettingsSection
        title={f.title}
        description={f.description}
        badge={badge}
        loading={res.loading}
        error={res.error}
        hasLoaded={res.hasLoaded}
        onRetry={res.reload}
        skeletonFields={2}
        dirty={dirty}
        saving={saving}
        onReset={reset}
        onSave={requestSave}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="text-muted">{f.defaultRate}</span>
          <span className="flex items-baseline gap-3">
            <span className="num font-semibold text-ink">{saved?.defaultCommissionRate ?? '—'}%</span>
            <Link href="/dashboard/settings" className="text-xs text-primary-text hover:underline">
              {f.change}
            </Link>
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{f.launchPromo}</p>
            <p className="mt-0.5 text-xs text-muted">{f.launchPromoHint}</p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v);
              setFieldError(null);
            }}
            aria-label={f.launchPromo}
          />
        </div>
        {enabled && (
          <Input
            label={f.endDateLabel}
            type="date"
            value={date}
            min={tashkentToday()}
            error={fieldError ?? undefined}
            onChange={(e) => {
              setDate(e.target.value);
              if (fieldError) setFieldError(null);
            }}
            wrapperClassName="max-w-xs"
          />
        )}
        {saved?.launchPromoActive === false && savedDate && (
          <Notice tone="neutral">{f.endedOn(formatDateShort(saved.launchPromoCommissionUntil))}</Notice>
        )}
      </SettingsSection>

      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={save}
        isPending={saving}
        tone="default"
        title={nextDate ? f.confirmSaveTitle : f.confirmDisableTitle}
        confirmLabel={m.common.save}
        description={
          nextDate
            ? f.confirmSaveBody(formatDateShort(tashkentDateToIso(nextDate)))
            : f.confirmDisableBody
        }
      />
    </>
  );
}
