'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Notice } from '@/components/settings/Notice';
import { useResource } from '@/hooks/useResource';
import { financeSettingsApi, type VendorSettlementMode } from '@/lib/compliance-api';
import {
  apiErrorMessage,
  describeVendorSettlement,
  isIsoDate,
  isoToTashkentDate,
  tashkentDateToIso,
} from '@/lib/compliance';
import { t } from '@/locales';

/** Sotuvchi bilan hisob-kitob — e-tijorat qonuni 23-modda, LEGAL-COMPLIANCE §7. */
export function VendorSettlementCard() {
  const m = t();
  const f = m.finance.vendorSettlement;
  const MODE_LABEL: Record<VendorSettlementMode, string> = { cash: f.cash, wallet: f.wallet };
  const MODE_ITEMS: { value: VendorSettlementMode; label: string }[] = [
    { value: 'cash', label: f.cash },
    { value: 'wallet', label: f.wallet },
  ];
  const { toast } = useToast();
  const res = useResource(
    () => financeSettingsApi.getVendorSettlement().then((r) => r.data.data),
    f.loadError
  );
  const saved = res.data;
  const savedDate = isoToTashkentDate(saved?.vendorWalletSettlementFrom);
  const [mode, setMode] = useState<VendorSettlementMode>('cash');
  const [hasDate, setHasDate] = useState(false);
  const [date, setDate] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setMode(saved?.vendorSettlementMode ?? 'cash');
    setHasDate(savedDate !== '');
    setDate(savedDate);
    setDateError(null);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reset, [saved?.vendorSettlementMode, savedDate]);

  const nextDate = hasDate ? date : '';
  const dirty = !!saved && (mode !== saved.vendorSettlementMode || nextDate !== savedDate);

  const requestSave = () => {
    if (hasDate && !isIsoDate(date)) {
      setDateError(m.finance.enterDate);
      return;
    }
    setDateError(null);
    setConfirming(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      // Sana o'zgarmagan bo'lsa yuborilmaydi — asl vaqt yaxlitlanmasin.
      const r = await financeSettingsApi.updateVendorSettlement({
        vendorSettlementMode: mode,
        ...(nextDate !== savedDate && {
          vendorWalletSettlementFrom: nextDate ? tashkentDateToIso(nextDate) : null,
        }),
      });
      res.setData(r.data.data);
      toast({
        title: m.finance.saved,
        description: f.savedDesc(MODE_LABEL[r.data.data.effectiveVendorSettlementMode]),
        variant: 'success',
      });
      setConfirming(false);
    } catch (err) {
      toast({ title: m.common.error, description: apiErrorMessage(err, m.common.saveError), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const preview = describeVendorSettlement({
    vendorSettlementMode: mode,
    vendorWalletSettlementFrom: nextDate ? tashkentDateToIso(nextDate) : null,
  });

  return (
    <>
      <SettingsSection
        title={f.title}
        description={f.description}
        badge={
          saved ? (
            <Badge variant={saved.effectiveVendorSettlementMode === 'wallet' ? 'info' : 'neutral'} dot>
              {f.effective(MODE_LABEL[saved.effectiveVendorSettlementMode])}
            </Badge>
          ) : null
        }
        loading={res.loading}
        error={res.error}
        hasLoaded={res.hasLoaded}
        onRetry={res.reload}
        dirty={dirty}
        saving={saving}
        onReset={reset}
        onSave={requestSave}
      >
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium text-ink">{f.adminChoice}</p>
          <SegmentedControl
            ariaLabel={f.modeAria}
            items={MODE_ITEMS}
            value={mode}
            onChange={(v) => setMode(v)}
          />
          <p className="text-xs text-muted">
            {f.modeHint}
          </p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{f.autoDate}</p>
            <p className="mt-0.5 text-xs text-muted">
              {f.autoDateHint}
            </p>
          </div>
          <Switch checked={hasDate} onCheckedChange={setHasDate} aria-label={f.autoDate} />
        </div>
        {hasDate && (
          <Input
            label={f.dateLabel}
            type="date"
            value={date}
            error={dateError ?? undefined}
            onChange={(e) => setDate(e.target.value)}
            wrapperClassName="max-w-xs"
          />
        )}
        <Notice tone="info">{preview}</Notice>
      </SettingsSection>

      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={save}
        isPending={saving}
        tone="default"
        title={f.confirmTitle}
        confirmLabel={m.common.save}
        description={
          <>
            <p>{preview}</p>
            <p className="mt-2">
              {f.confirmBody}
            </p>
          </>
        }
      />
    </>
  );
}
