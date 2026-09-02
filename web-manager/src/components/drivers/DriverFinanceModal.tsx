'use client';

import { useEffect, useState } from 'react';
import { addDriverFunds, setDriverCommissionRate, DriverProfile } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatMoney } from '@/lib/format';

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
  const { toast } = useToast();
  const [current, setCurrent] = useState<DriverProfile | null>(driver);
  const [fundsAmount, setFundsAmount] = useState('');
  const [fundsNote, setFundsNote] = useState('');
  const [fundsError, setFundsError] = useState<string | null>(null);
  const [commissionInput, setCommissionInput] = useState('');
  const [commissionError, setCommissionError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'funds' | 'commission' | null>(null);
  // Inline step rather than a stacked dialog — a modal on top of a modal traps
  // focus twice and buries the amount the operator is meant to be checking.
  const [fundsConfirm, setFundsConfirm] = useState(false);

  // Re-seed the form whenever a different driver opens the modal.
  useEffect(() => {
    setCurrent(driver);
    setFundsAmount('');
    setFundsNote('');
    setFundsError(null);
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
    const amount = Number(fundsAmount);
    if (!fundsAmount.trim() || Number.isNaN(amount) || amount === 0) {
      setFundsError('Noldan farqli summa kiriting');
      return;
    }
    setFundsError(null);
    setFundsConfirm(true);
  };

  const handleAddFunds = async () => {
    if (!current) return;
    const amount = Number(fundsAmount);
    const verb = amount > 0 ? 'qoʻshiladi' : 'yechiladi';
    setFundsConfirm(false);

    setSaving('funds');
    try {
      const updated = await addDriverFunds(current.id, amount, fundsNote.trim() || undefined);
      applyUpdate(updated);
      setFundsAmount('');
      setFundsNote('');
      toast({
        title: `${formatMoney(Math.abs(amount))} ${verb}`,
        description: `${updated.firstName} ${updated.lastName} · yangi qoldiq ${formatMoney(
          updated.walletBalance ?? 0
        )}`,
        variant: 'success',
      });
    } catch (err) {
      console.error('Add funds failed:', err);
      toast({
        title: 'Balansni yangilab boʻlmadi',
        description: 'Summa oʻzgarmadi. Qayta urinib koʻring.',
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
      setCommissionError('0 dan 100 gacha foiz kiriting');
      return;
    }
    setCommissionError(null);
    setSaving('commission');
    try {
      const updated = await setDriverCommissionRate(current.id, rate);
      applyUpdate(updated);
      toast({
        title:
          rate == null ? 'Platforma komissiyasi qoʻllanadi' : `Komissiya ${rate}% qilib saqlandi`,
        description: `${updated.firstName} ${updated.lastName}`,
        variant: 'success',
      });
    } catch (err) {
      console.error('Set commission rate failed:', err);
      toast({ title: 'Komissiya foizini yangilab boʻlmadi', variant: 'error' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal
      isOpen={!!driver}
      onClose={onClose}
      title={current ? `${current.firstName} ${current.lastName} — moliya` : 'Moliya'}
      subtitle="Pul harakati tasdiqlashdan soʻng amalga oshadi"
      size="md"
    >
      {current && (
        <div className="space-y-5">
          <div className="rounded-ds-sm border border-line bg-surface-2/60 p-4 text-center">
            {/* Daftardan hisoblangan qoldiq — haydovchi o'z ilovasida AYNAN
                shu raqamni ko'radi. `balance` ustuni yechib olingan pulni
                hisobga olmagani uchun bu yerda ishlatilmaydi. */}
            <p className="text-xs text-muted">
              {(current.walletBalance ?? 0) < 0 ? 'Qarz' : 'Hamyon'}
            </p>
            <p
              className={`font-mono text-xl font-bold mt-1 tabular-nums ${
                (current.walletBalance ?? 0) < 0
                  ? 'text-danger-deep dark:text-danger-light'
                  : 'text-primary-700 dark:text-primary-300'
              }`}
            >
              {formatMoney(current.walletBalance ?? 0)}
            </p>
            {current.commissionRate != null && (
              <p className="text-[11px] text-subtle mt-1">
                Komissiya: <span className="font-mono">{current.commissionRate}%</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Balansni toʻldirish / tuzatish</p>
            <Input
              placeholder="Summa (ayirish uchun manfiy son)"
              type="number"
              mono
              value={fundsAmount}
              onChange={(e) => {
                setFundsAmount(e.target.value);
                if (fundsError) setFundsError(null);
              }}
              error={fundsError ?? undefined}
              aria-label="Summa"
              // Locked while confirming: the figure in the confirmation must be
              // the figure that gets applied.
              disabled={fundsConfirm}
            />
            <Input
              placeholder="Izoh (ixtiyoriy)"
              value={fundsNote}
              onChange={(e) => setFundsNote(e.target.value)}
              aria-label="Izoh"
              disabled={fundsConfirm}
            />
            {fundsConfirm && current ? (
              <div
                role="alertdialog"
                aria-label="Balans oʻzgarishini tasdiqlash"
                className="rounded-ds-xs border border-override/40 bg-override/[0.06] p-3 space-y-3"
              >
                <p className="text-sm text-ink">
                  <span className="font-semibold">
                    {current.firstName} {current.lastName}
                  </span>{' '}
                  hisobidan{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {formatMoney(Math.abs(Number(fundsAmount)))}
                  </span>{' '}
                  {Number(fundsAmount) > 0 ? 'qoʻshiladi' : 'yechiladi'}.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setFundsConfirm(false)}
                    className="flex-1"
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleAddFunds}
                    isLoading={saving === 'funds'}
                    className="flex-1"
                  >
                    Tasdiqlash
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
                Qoʻllash
              </Button>
            )}
          </div>

          <div className="space-y-2 pt-4 border-t border-line">
            <p className="text-sm font-medium text-ink">Komissiya foizi</p>
            <Input
              placeholder="% — boʻsh qoldirilsa platforma qiymati"
              type="number"
              mono
              value={commissionInput}
              onChange={(e) => {
                setCommissionInput(e.target.value);
                if (commissionError) setCommissionError(null);
              }}
              error={commissionError ?? undefined}
              aria-label="Komissiya foizi"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSetCommission}
              isLoading={saving === 'commission'}
              className="w-full"
            >
              Saqlash
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
