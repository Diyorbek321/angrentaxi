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

const MODE_ITEMS: { value: VendorSettlementMode; label: string }[] = [
  { value: 'cash', label: 'Naqd' },
  { value: 'wallet', label: 'Hamyon' },
];

const MODE_LABEL: Record<VendorSettlementMode, string> = { cash: 'Naqd', wallet: 'Hamyon' };

/** Sotuvchi bilan hisob-kitob — e-tijorat qonuni 23-modda, LEGAL-COMPLIANCE §7. */
export function VendorSettlementCard() {
  const { toast } = useToast();
  const res = useResource(
    () => financeSettingsApi.getVendorSettlement().then((r) => r.data.data),
    'Hisob-kitob sozlamalarini yuklab boʻlmadi.'
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
      setDateError('Sanani kiriting');
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
        title: 'Saqlandi',
        description: `Amaldagi rejim: ${MODE_LABEL[r.data.data.effectiveVendorSettlementMode]}.`,
        variant: 'success',
      });
      setConfirming(false);
    } catch (err) {
      toast({ title: 'Xatolik', description: apiErrorMessage(err, 'Saqlashda xatolik'), variant: 'error' });
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
        title="Sotuvchi bilan hisob-kitob"
        description="Naqd ovqat/market buyurtmasida kuryer tovar pulini restoran/doʻkonga qanday oʻtkazadi. Karta buyurtmalariga taʼsir qilmaydi."
        badge={
          saved ? (
            <Badge variant={saved.effectiveVendorSettlementMode === 'wallet' ? 'info' : 'neutral'} dot>
              Amalda: {MODE_LABEL[saved.effectiveVendorSettlementMode]}
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
          <p className="text-[13px] font-medium text-ink">Admin tanlovi</p>
          <SegmentedControl
            ariaLabel="Hisob-kitob rejimi"
            items={MODE_ITEMS}
            value={mode}
            onChange={(v) => setMode(v)}
          />
          <p className="text-xs text-muted">
            Naqd — kuryer doʻkonga naqd toʻlaydi. Hamyon — olib ketishda kuryer hamyonidan sotuvchiga oʻtkaziladi
            (komissiya ushlanadi), hamyonda mablagʻ yetmasa kuryer buyurtmani qabul qila olmaydi.
          </p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Avtomatik hamyon rejimi sanasi</p>
            <p className="mt-0.5 text-xs text-muted">
              Shu kundan rejim admin tanlovidan qatʼi nazar «Hamyon» (qonun kuchga kiradi: 12.12.2026).
            </p>
          </div>
          <Switch checked={hasDate} onCheckedChange={setHasDate} aria-label="Avtomatik hamyon rejimi sanasi" />
        </div>
        {hasDate && (
          <Input
            label="Sana (Toshkent, 00:00 dan)"
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
        title="Hisob-kitob rejimini saqlash"
        confirmLabel="Saqlash"
        description={
          <>
            <p>{preview}</p>
            <p className="mt-2">
              Hamyon rejimida naqd buyurtmalar kuryer hamyonidagi qoldiq bilan cheklanadi va sotuvchi pulni hamyoniga
              oladi.
            </p>
          </>
        }
      />
    </>
  );
}
