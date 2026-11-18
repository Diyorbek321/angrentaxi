'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { REJECT_REASON_KEYS, rejectReasonLabel, rejectReasonValue } from './queue';
import { t } from '@/locales';

/** Rad etish sababi majburiy — mijozga shu matn yuboriladi. */
export function RejectModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const m = t();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setPending(false);
    }
  }, [isOpen]);

  const confirm = async () => {
    if (!reason) return;
    setPending(true);
    try {
      await onConfirm(reason);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      tone="danger"
      title={m.orders.reject.title}
      subtitle={m.orders.reject.subtitle}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            {m.common.cancel}
          </Button>
          <Button variant="danger" size="lg" disabled={!reason} isLoading={pending} onClick={confirm}>
            {m.orders.reject.confirm}
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-1.5">
        <legend className="sr-only">{m.orders.reject.legend}</legend>
        {REJECT_REASON_KEYS.map((key) => {
          // `r` — API'ga ketadigan o'zbekcha matn; yozuv esa faol tilda.
          const r = rejectReasonValue(key);
          return (
          <label
            key={key}
            className={cn(
              'flex min-h-touch cursor-pointer items-center gap-3 rounded-ds-sm border px-3 text-body transition-colors',
              reason === r ? 'border-primary bg-mint-tint text-ink' : 'border-line bg-surface text-ink hover:bg-surface-2'
            )}
          >
            <input
              type="radio"
              name="reject-reason"
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="h-4 w-4 accent-[rgb(var(--primary-text))]"
            />
            <span className="font-medium">{rejectReasonLabel(key)}</span>
          </label>
          );
        })}
      </fieldset>
    </Modal>
  );
}
