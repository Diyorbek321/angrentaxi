'use client';

import { useEffect, useState } from 'react';
import { addDriverFunds, setDriverCommissionRate, DriverProfile } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { MoneyText } from '@/components/ui/MoneyText';
import { formatMoney, fullName } from '@/lib/format';
import { apiErrorTitle } from '@/lib/api-error';
import {
  balanceAdjustmentErrorMessage,
  manualAdjustmentLimitMessage,
  validateBalanceAdjustment,
} from '@/lib/balance-adjustment';
import { DriverAuditHistory } from './DriverAuditHistory';
import { t } from '@/locales';

export interface DriverFinanceModalProps {
  driver: DriverProfile | null;
  onClose: () => void;
  /** Merges the server's updated profile back into the roster row. */
  onUpdated: (driver: DriverProfile) => void;
}

/**
 * Balance and commission for one driver.
 *
 * Money movement is the one routine-looking action that gets a confirmation
 * (skill rule: modals only for destructive/financial acts) — and that
 * confirmation restates the driver and the amount, so a mistyped zero cannot
 * slip past. Commission is a setting, not a transfer: it gets a toast.
 */
export function DriverFinanceModal({ driver, onClose, onUpdated }: DriverFinanceModalProps) {
  const m = t();
  const f = m.drivers.finance;
  const { toast } = useToast();
  const [current, setCurrent] = useState<DriverProfile | null>(driver);
  const [fundsAmount, setFundsAmount] = useState('');
  const [fundsNote, setFundsNote] = useState('');
  const [fundsError, setFundsError] = useState<string | null>(null);
  const [fundsNoteError, setFundsNoteError] = useState<string | null>(null);
  const [commissionInput, setCommissionInput] = useState('');
  const [commissionError, setCommissionError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'funds' | 'commission' | null>(null);
  // Inline step rather than a stacked dialog — a modal on top of a modal traps
  // focus twice and buries the amount the operator is meant to be checking.
  const [fundsConfirm, setFundsConfirm] = useState(false);
  // Yangi tuzatishdan keyin «Amallar tarixi» qaytadan o'qiladi.
  const [historyKey, setHistoryKey] = useState(0);

  // Re-seed the form whenever a different driver opens the modal.
  useEffect(() => {
    setCurrent(driver);
    setFundsAmount('');
    setFundsNote('');
    setFundsError(null);
    setFundsNoteError(null);
    setCommissionError(null);
    setCommissionInput(driver?.commissionRate != null ? String(driver.commissionRate) : '');
  }, [driver]);

  const applyUpdate = (updated: DriverProfile) => {
    setCurrent((prev) => (prev ? { ...prev, ...updated } : updated));
    onUpdated(updated);
  };

  /** Validates and opens the inline confirmation step — money never moves here. */
  const requestAddFunds = () => {
    if (!current) return;
    // Butun so'm, ≠ 0, |summa| ≤ 5 mln — backend DTO bilan bir xil (§25 #6).
    const invalid = validateBalanceAdjustment(fundsAmount);
    if (invalid) {
      setFundsError(invalid);
      return;
    }
    // Izoh majburiy: amallar jurnaliga va haydovchiga push matniga tushadi.
    if (!fundsNote.trim()) {
      setFundsNoteError(f.noteRequired);
      return;
    }
    setFundsError(null);
    setFundsNoteError(null);
    setFundsConfirm(true);
  };

  const handleAddFunds = async () => {
    if (!current) return;
    const amount = Number(fundsAmount);
    const verb = amount > 0 ? f.added : f.withdrawn;
    setFundsConfirm(false);

    setSaving('funds');
    try {
      const updated = await addDriverFunds(current.id, amount, fundsNote.trim());
      applyUpdate(updated);
      setFundsAmount('');
      setFundsNote('');
      setHistoryKey((k) => k + 1);
      toast({
        title: `${formatMoney(Math.abs(amount))} ${verb}`,
        description: f.newBalance(fullName(updated.firstName, updated.lastName), formatMoney(updated.walletBalance ?? 0)),
        variant: 'success',
      });
    } catch (err) {
      console.error('Add funds failed:', err);
      // 403 MANUAL_ADJUSTMENT_LIMIT — chegara summa maydoni ostida ham ko'rinadi.
      const limitMessage = manualAdjustmentLimitMessage(err);
      if (limitMessage) setFundsError(limitMessage);
      toast({
        title: apiErrorTitle(err, f.balanceError),
        description: balanceAdjustmentErrorMessage(err, f.balanceErrorDesc),
        variant: 'error',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleSetCommission = async () => {
    if (!current) return;
    const trimmed = commissionInput.trim();
    const rate = trimmed === '' ? null : Number(trimmed);
    if (rate != null && (Number.isNaN(rate) || rate < 0 || rate > 100)) {
      setCommissionError(f.commissionRange);
      return;
    }
    setCommissionError(null);
    setSaving('commission');
    try {
      const updated = await setDriverCommissionRate(current.id, rate);
      applyUpdate(updated);
      toast({
        title:
          rate == null ? f.commissionDefault : f.commissionSaved(rate),
        description: fullName(updated.firstName, updated.lastName),
        variant: 'success',
      });
    } catch (err) {
      console.error('Set commission rate failed:', err);
      toast({ title: f.commissionError, variant: 'error' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal
      isOpen={!!driver}
      onClose={onClose}
      title={current ? f.title(fullName(current.firstName, current.lastName)) : f.titleShort}
      subtitle={f.subtitle}
      size="md"
    >
      {current && (
        <div className="space-y-5">
          <div className="rounded-ds-md border border-line bg-surface-2/60 p-4 text-center">
            {/* Daftardan hisoblangan qoldiq — haydovchi o'z ilovasida AYNAN
                shu raqamni ko'radi. `balance` ustuni yechib olingan pulni
                hisobga olmagani uchun bu yerda ishlatilmaydi. */}
            <p className="text-xs text-muted">
              {(current.walletBalance ?? 0) < 0 ? f.debt : f.wallet}
            </p>
            <p
              className={`num text-kpi mt-1 ${
                (current.walletBalance ?? 0) < 0
                  ? 'text-danger-deep dark:text-danger-light'
                  : 'text-ink'
              }`}
            >
              <MoneyText value={current.walletBalance ?? 0} />
            </p>
            {current.commissionRate != null && (
              <p className="text-[11px] text-subtle mt-1">
                {f.commissionLabel} <span className="num">{current.commissionRate}%</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{f.topUpTitle}</p>
            <Input
              placeholder={f.amountPlaceholder}
              type="number"
              inputMode="numeric"
              step={1}
              value={fundsAmount}
              onChange={(e) => {
                setFundsAmount(e.target.value);
                if (fundsError) setFundsError(null);
              }}
              error={fundsError ?? undefined}
              aria-label={f.amount}
              // Locked while confirming: the figure in the confirmation must be
              // the figure that gets applied.
              disabled={fundsConfirm}
            />
            <Input
              placeholder={f.notePlaceholder}
              value={fundsNote}
              onChange={(e) => {
                setFundsNote(e.target.value);
                if (fundsNoteError) setFundsNoteError(null);
              }}
              error={fundsNoteError ?? undefined}
              aria-label={f.note}
              required
              maxLength={200}
              disabled={fundsConfirm}
            />
            {fundsConfirm && current ? (
              <div
                role="alertdialog"
                aria-label={f.confirmAria}
                className="rounded-ds-sm border border-override/40 bg-override-tint p-3 space-y-3"
              >
                <p className="text-[13px] text-ink">
                  <span className="font-semibold">{fullName(current.firstName, current.lastName)}</span>
                  {f.confirmMid}
                  <MoneyText value={Math.abs(Number(fundsAmount))} className="font-semibold" />{' '}
                  {Number(fundsAmount) > 0 ? f.added : f.withdrawn}.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setFundsConfirm(false)}
                    className="flex-1"
                  >
                    {m.common.cancel}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleAddFunds}
                    isLoading={saving === 'funds'}
                    className="flex-1"
                  >
                    {m.common.confirm}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={requestAddFunds}
                isLoading={saving === 'funds'}
                className="w-full"
              >
                {f.apply}
              </Button>
            )}
          </div>

          <div className="pt-4 border-t border-line">
            <DriverAuditHistory driverId={current.id} refreshKey={historyKey} />
          </div>

          <div className="space-y-2 pt-4 border-t border-line">
            <p className="text-sm font-medium text-ink">{f.commissionTitle}</p>
            <Input
              placeholder={f.commissionPlaceholder}
              type="number"
                value={commissionInput}
              onChange={(e) => {
                setCommissionInput(e.target.value);
                if (commissionError) setCommissionError(null);
              }}
              error={commissionError ?? undefined}
              aria-label={f.commissionTitle}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSetCommission}
              isLoading={saving === 'commission'}
              className="w-full"
            >
              {m.common.save}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
