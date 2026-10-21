'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { tashkentToday } from '@/lib/compliance';
import { taxStatusLabels, type DriverLegalErrors, type DriverLegalForm } from '@/lib/driver-legal';
import { t } from '@/locales';

function taxStatusOptions() {
  const labels = taxStatusLabels();
  return [
    { value: '', label: t().drivers.legal.modal.notEntered },
    { value: 'self_employed', label: labels.self_employed },
    { value: 'individual_entrepreneur', label: labels.individual_entrepreneur },
  ];
}

const digits = (v: string) => v.replace(/\D/g, '');

export interface DriverLegalModalProps {
  /** `null` — yopiq. */
  form: DriverLegalForm | null;
  errors: DriverLegalErrors;
  saving: boolean;
  onChange: (patch: Partial<DriverLegalForm>) => void;
  onClose: () => void;
  onSave: () => void;
}

/** Huquqiy profilni tuzatish — menejer hujjat bilan solishtirib kiritadi. */
export function DriverLegalModal({ form, errors, saving, onChange, onClose, onSave }: DriverLegalModalProps) {
  const today = tashkentToday();
  const m = t().drivers.legal.modal;
  const mc = t().common;
  return (
    <Modal
      isOpen={!!form}
      onClose={saving ? () => undefined : onClose}
      title={m.title}
      description={m.description}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {mc.cancel}
          </Button>
          <Button onClick={onSave} isLoading={saving}>
            {mc.save}
          </Button>
        </>
      }
    >
      {form && (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          noValidate
        >
          <Select
            label={m.taxStatus}
            options={taxStatusOptions()}
            value={form.taxStatus}
            onChange={(e) => onChange({ taxStatus: e.target.value as DriverLegalForm['taxStatus'] })}
          />
          <Input
            label={m.citizenship}
            mono
            maxLength={2}
            value={form.citizenship}
            error={errors.citizenship}
            hint={m.citizenshipHint}
            onChange={(e) => onChange({ citizenship: e.target.value.toUpperCase() })}
          />
          <Input
            label={m.pinfl}
            mono
            inputMode="numeric"
            maxLength={14}
            placeholder={m.digits(14)}
            value={form.pinfl}
            error={errors.pinfl}
            onChange={(e) => onChange({ pinfl: digits(e.target.value) })}
          />
          <Input
            label={m.tin}
            mono
            inputMode="numeric"
            maxLength={9}
            placeholder={m.digits(9)}
            value={form.tin}
            error={errors.tin}
            hint={form.taxStatus === 'individual_entrepreneur' ? m.tinRequiredIe : undefined}
            onChange={(e) => onChange({ tin: digits(e.target.value) })}
          />
          <Input
            label={m.birthDate}
            type="date"
            max={today}
            value={form.birthDate}
            error={errors.birthDate}
            onChange={(e) => onChange({ birthDate: e.target.value })}
          />
          <Input
            label={m.licenceIssued}
            type="date"
            max={today}
            value={form.drivingLicenceIssuedAt}
            error={errors.drivingLicenceIssuedAt}
            onChange={(e) => onChange({ drivingLicenceIssuedAt: e.target.value })}
          />
          <Input
            label={m.taxiLicence}
            mono
            maxLength={50}
            value={form.taxiLicenceNumber}
            error={errors.taxiLicenceNumber}
            onChange={(e) => onChange({ taxiLicenceNumber: e.target.value })}
          />
          <Input
            label={m.licenceRegion}
            maxLength={100}
            placeholder={m.licenceRegionPlaceholder}
            value={form.taxiLicenceRegion}
            error={errors.taxiLicenceRegion}
            onChange={(e) => onChange({ taxiLicenceRegion: e.target.value })}
          />
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}
