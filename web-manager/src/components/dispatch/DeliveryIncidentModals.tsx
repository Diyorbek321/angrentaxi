'use client';

import { useEffect, useState } from 'react';
import { Order, confirmDeliveryReturned, markDeliveryFailed } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error';
import {
  DELIVERY_FAILURE_REASONS,
  INCIDENT_NOTE_MAX,
  deliveryFailureReasonLabels,
  validateIncidentNote,
  type DeliveryFailureReason,
} from '@/lib/delivery-incident';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { shortId } from '@/lib/format';
import { t } from '@/locales';

interface IncidentModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onDone: (order: Order) => void;
}

/** Izoh maydoni + tekshiruv — ikkala modal uchun bir xil. */
function useIncidentNote(isOpen: boolean) {
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  // Har ochilishda bo'sh forma.
  useEffect(() => {
    if (isOpen) {
      setNote('');
      setTouched(false);
    }
  }, [isOpen]);
  return { note, setNote, touched, setTouched, error: validateIncidentNote(note) };
}

/**
 * Dispetcher: "Yetkazib bo'lmadi → qaytarish". Kuryerdan farqli, kutish
 * talabi yo'q — dispetcher mijoz bilan gaplashib qaror qiladi. Izoh audit uchun.
 */
export function DeliveryFailedModal({ order, isOpen, onClose, onDone }: IncidentModalProps) {
  const m = t().dispatch.deliveryIncident;
  const { toast } = useToast();
  const [reason, setReason] = useState<DeliveryFailureReason>('customer_absent');
  const { note, setNote, touched, setTouched, error } = useIncidentNote(isOpen);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setReason('customer_absent');
  }, [isOpen]);

  const labels = deliveryFailureReasonLabels();
  const options = DELIVERY_FAILURE_REASONS.map((r) => ({ value: r, label: labels[r] }));

  const submit = async () => {
    setTouched(true);
    if (error) return;
    setSaving(true);
    try {
      const updated = await markDeliveryFailed(order.id, reason, note);
      toast({ title: m.failedToast(shortId(order.id)), variant: 'info' });
      onDone(updated);
    } catch (err) {
      console.error('Mark delivery failed failed:', err);
      toast({ title: m.actionFailed, description: apiErrorMessage(err, m.tryAgain), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={m.failTitle} subtitle={shortId(order.id)} size="md">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-[13px] text-muted leading-relaxed">{m.failExplainer}</p>
        <Select
          label={m.reasonLabel}
          options={options}
          value={reason}
          onChange={(e) => setReason(e.target.value as DeliveryFailureReason)}
        />
        <Textarea
          label={m.noteLabel}
          placeholder={m.failNotePlaceholder}
          value={note}
          maxLength={INCIDENT_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => setTouched(true)}
          error={touched ? error ?? undefined : undefined}
          hint={m.noteHint}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t().common.cancel}
          </Button>
          <Button type="submit" variant="danger" isLoading={saving}>
            {m.failSubmit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Dispetcher: tovar jo'natuvchiga (sotuvchi/posilka egasi) qaytib keldi. */
export function ConfirmReturnedModal({ order, isOpen, onClose, onDone }: IncidentModalProps) {
  const m = t().dispatch.deliveryIncident;
  const { toast } = useToast();
  const { note, setNote, touched, setTouched, error } = useIncidentNote(isOpen);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setTouched(true);
    if (error) return;
    setSaving(true);
    try {
      const updated = await confirmDeliveryReturned(order.id, note);
      toast({ title: m.returnedToast(shortId(order.id)), variant: 'success' });
      onDone(updated);
    } catch (err) {
      console.error('Confirm delivery returned failed:', err);
      toast({ title: m.actionFailed, description: apiErrorMessage(err, m.tryAgain), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={m.returnTitle} subtitle={shortId(order.id)} size="md">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-[13px] text-muted leading-relaxed">{m.returnExplainer}</p>
        <Textarea
          label={m.noteLabel}
          placeholder={m.returnNotePlaceholder}
          value={note}
          maxLength={INCIDENT_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => setTouched(true)}
          error={touched ? error ?? undefined : undefined}
          hint={m.noteHint}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t().common.cancel}
          </Button>
          <Button type="submit" isLoading={saving}>
            {m.returnSubmit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
