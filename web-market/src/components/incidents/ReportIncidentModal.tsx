'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import {
  VENDOR_INCIDENT_CATEGORIES,
  defaultSubjectFor,
  incidentsApi,
  reportProblem,
  type IncidentSubject,
  type IncidentVertical,
  type VendorIncidentCategory,
} from '@/lib/incidents';
import { errorMessage } from '@/lib/utils';
import { t } from '@/locales';

/** Kuryer yoki mijoz haqida xabar (INCIDENT-POLICY §3) — sabab + matn, kim haqida. */
export function ReportIncidentModal({
  isOpen,
  onClose,
  vertical,
  orderId,
}: {
  isOpen: boolean;
  onClose: () => void;
  vertical: IncidentVertical;
  orderId: string;
}) {
  const m = t().incidents;
  const { toast } = useToast();
  const [category, setCategory] = useState<VendorIncidentCategory>('rude');
  const [subject, setSubject] = useState<IncidentSubject>('courier');
  const [description, setDescription] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCategory('rude');
      setSubject('courier');
      setDescription('');
      setInvalid(false);
      setPending(false);
    }
  }, [isOpen]);

  const send = async () => {
    if (reportProblem({ description })) {
      setInvalid(true);
      return;
    }
    setPending(true);
    try {
      await incidentsApi.report({ vertical, orderId, category, description, subject });
      toast({ title: m.sent, variant: 'success' });
      onClose();
    } catch (err) {
      toast({ title: m.failed, description: errorMessage(err), variant: 'error' });
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={m.modalTitle}
      subtitle={m.modalSubtitle}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t().common.cancel}
          </Button>
          <Button size="lg" isLoading={pending} onClick={() => void send()}>
            {m.send}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Select
          label={m.category}
          value={category}
          onChange={(e) => {
            const next = e.target.value as VendorIncidentCategory;
            setCategory(next);
            setSubject(defaultSubjectFor(next));
          }}
          options={VENDOR_INCIDENT_CATEGORIES.map((c) => ({ value: c, label: m.categories[c] ?? c }))}
        />
        <Select
          label={m.subject}
          value={subject}
          onChange={(e) => setSubject(e.target.value as IncidentSubject)}
          options={[
            { value: 'courier', label: m.subjects.courier },
            { value: 'customer', label: m.subjects.customer },
          ]}
        />
        <Textarea
          label={m.description}
          required
          rows={4}
          maxLength={1000}
          placeholder={m.descriptionPlaceholder}
          value={description}
          error={invalid ? m.descriptionError : undefined}
          onChange={(e) => {
            setDescription(e.target.value);
            if (invalid) setInvalid(reportProblem({ description: e.target.value }) !== null);
          }}
        />
      </div>
    </Modal>
  );
}
