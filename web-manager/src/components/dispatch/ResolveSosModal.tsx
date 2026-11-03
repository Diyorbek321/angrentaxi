'use client';

import { useEffect, useState } from 'react';
import { resolveSosAlert, type SosAlert } from '@/lib/api';
import { SOS_NOTE_MAX, sosNoteError } from '@/lib/safety';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { shortId } from '@/lib/format';
import { t } from '@/locales';

interface ResolveSosModalProps {
  alert: SosAlert | null;
  onClose: () => void;
  onResolved: (id: string) => void;
  onFailed: () => void;
}

/** SOS yopish — izoh MAJBURIY, kim yopgani serverda yoziladi (INCIDENT-POLICY §4). */
export function ResolveSosModal({ alert, onClose, onResolved, onFailed }: ResolveSosModalProps) {
  const m = t().safety.resolve;
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (alert) {
      setNote('');
      setTouched(false);
    }
  }, [alert]);

  const error = sosNoteError(note);
  const errorText = error === 'tooShort' ? m.tooShort : error === 'tooLong' ? m.tooLong : undefined;

  const submit = async () => {
    setTouched(true);
    if (!alert || error) return;
    setSaving(true);
    try {
      await resolveSosAlert(alert.id, note);
      onResolved(alert.id);
    } catch {
      onFailed();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={alert !== null}
      onClose={onClose}
      title={m.title}
      subtitle={alert ? shortId(alert.orderId) : undefined}
      size="md"
      tone="danger"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-[13px] text-muted leading-relaxed">{m.subtitle}</p>
        <Textarea
          label={m.noteLabel}
          placeholder={m.notePlaceholder}
          value={note}
          required
          maxLength={SOS_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => setTouched(true)}
          error={touched ? errorText : undefined}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {m.cancel}
          </Button>
          <Button type="submit" variant="primary" isLoading={saving}>
            {m.submit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
