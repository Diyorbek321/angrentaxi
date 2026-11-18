'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { DetailCard } from '@/components/ui/KeyValue';
import { Modal } from '@/components/ui/Modal';
import { MoneyText } from '@/components/ui/MoneyText';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { getCurrentUserProfile } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import {
  debtCloseErrorMessage,
  isDebtCloseReasonValid,
  selectedDebtTotal,
  WALLET_DEBT_REASON_MAX,
  type WalletDebtCloseMode,
  type WalletDebtView,
} from '@/lib/wallet-debt';
import { closePassengerDebt, getPassengerDebt } from '@/lib/wallet-debt-api';
import { t } from '@/locales';

/**
 * Yo'lovchi hamyon qarzi (INCIDENT-POLICY §7). Panelda yo'lovchi sahifasi yo'q,
 * shuning uchun buyurtma sahifasida turadi — menejer yo'lovchini telefon bo'yicha
 * buyurtmalar ro'yxatidan topadi. Qarz bo'lmasa karta ko'rinmaydi.
 */
export function PassengerDebtCard({ passengerId }: { passengerId: string }) {
  const m = t().safety.walletDebt;
  const { toast } = useToast();
  const [debt, setDebt] = useState<WalletDebtView | null>(null);
  const [canClose, setCanClose] = useState(false);
  /** `null` — dialog yopiq; `all` — hammasi; aks holda bitta qarz. */
  const [target, setTarget] = useState<'all' | string | null>(null);
  const [mode, setMode] = useState<WalletDebtCloseMode>('cash_received');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setDebt(await getPassengerDebt(passengerId));
    } catch {
      setFailed(true);
    }
  }, [passengerId]);

  useEffect(() => {
    void load();
    getCurrentUserProfile()
      .then((profile) => setCanClose(profile.role === 'admin' || profile.permissions.includes('drivers_finance')))
      .catch(() => setCanClose(false));
  }, [load]);

  if (failed) {
    return (
      <DetailCard title={m.title}>
        <p className="text-[13px] text-danger-deep dark:text-danger-light">{m.loadFailed}</p>
        <Button size="sm" variant="secondary" className="mt-2" onClick={() => void load()}>
          {m.retry}
        </Button>
      </DetailCard>
    );
  }
  if (!debt || debt.total <= 0) return null;

  const ids = target && target !== 'all' ? [target] : null;
  const amount = selectedDebtTotal(debt.items, ids);

  const open = (next: 'all' | string) => {
    setTarget(next);
    setMode('cash_received');
    setReason('');
  };

  const submit = async () => {
    setSaving(true);
    try {
      const result = await closePassengerDebt(passengerId, {
        mode,
        reason: reason.trim(),
        ...(ids ? { transactionIds: ids } : {}),
      });
      setDebt(result.debt);
      setTarget(null);
      toast({ title: m.closed(formatMoney(result.total)), variant: 'success' });
    } catch (err) {
      toast({ title: debtCloseErrorMessage(err, m.closeFailed), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailCard
      title={m.title}
      actions={
        canClose ? (
          <Button size="sm" variant="secondary" onClick={() => open('all')}>
            {m.closeAll}
          </Button>
        ) : undefined
      }
    >
      <p className="text-[13px] text-muted mb-2">
        {m.total}: <MoneyText value={debt.total} />
      </p>
      <ul className="flex flex-col gap-2">
        {debt.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="min-w-0">
              <span className="block">
                {item.orderId ? (
                  <Link href={`/orders/${item.orderId}`} className="text-primary-text hover:underline">
                    {m.reasons[item.reason]}
                  </Link>
                ) : (
                  m.reasons[item.reason]
                )}
              </span>
              <span className="block text-[11px] text-subtle num">{formatDateTime(item.createdAt)}</span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <MoneyText value={item.amount} />
              {canClose && debt.items.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => open(item.id)}>
                  {m.closeOne}
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {!canClose && <p className="text-[11px] text-subtle mt-2">{m.noPermission}</p>}

      <Modal
        isOpen={target !== null}
        onClose={() => setTarget(null)}
        tone="override"
        title={m.dialogTitle}
        subtitle={m.dialogSubtitle(formatMoney(amount))}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              {t().common.cancel}
            </Button>
            <Button onClick={() => void submit()} isLoading={saving} disabled={!isDebtCloseReasonValid(reason)}>
              {mode === 'cash_received' ? m.confirmCash : m.confirmWriteOff}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <RadioGroup<WalletDebtCloseMode>
            name="debt-close-mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'cash_received', label: m.modes.cash, description: m.modes.cashHint },
              { value: 'write_off', label: m.modes.writeOff, description: m.modes.writeOffHint },
            ]}
          />
          <Textarea
            label={m.reasonLabel}
            required
            maxLength={WALLET_DEBT_REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
          />
        </div>
      </Modal>
    </DetailCard>
  );
}
