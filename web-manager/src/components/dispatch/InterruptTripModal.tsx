'use client';

import { useEffect, useState } from 'react';
import type { Order } from '@/lib/api';
import { INTERRUPT_NOTE_MAX, INTERRUPT_REASONS, interruptTrip, type InterruptReason } from '@/lib/taxi-penalties';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { shortId } from '@/lib/format';
import { t } from '@/locales';

interface InterruptTripModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onDone: (order: Order) => void;
}

/** Dispetcher: safar uzildi (avariya/buzilish, INCIDENT-POLICY §5). */
export function InterruptTripModal({ order, isOpen, onClose, onDone }: InterruptTripModalProps) {
  const m = t().safety.penalties;
  const { toast } = useToast();
  const [reason, setReason] = useState<InterruptReason>('breakdown');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('breakdown');
      setNote('');
    }
  }, [isOpen]);

  const submit = async () => {
    setSaving(true);
    try {
      const updated = await interruptTrip(order.id, reason, note);
      toast({ title: m.done(shortId(order.id)), variant: 'success' });
      onDone(updated);
    } catch {
      toast({ title: m.failed, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={m.interruptTitle} subtitle={shortId(order.id)} size="md" tone="override">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-[13px] text-muted leading-relaxed">{m.interruptBody}</p>
        <Select
          label={m.reasonLabel}
          options={INTERRUPT_REASONS.map((r) => ({ value: r, label: m.reasons[r] }))}
          value={reason}
          onChange={(e) => setReason(e.target.value as InterruptReason)}
        />
        <Textarea
          label={m.noteLabel}
          value={note}
          maxLength={INTERRUPT_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t().common.cancel}
          </Button>
          <Button type="submit" variant="override" isLoading={saving}>
            {m.submit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
