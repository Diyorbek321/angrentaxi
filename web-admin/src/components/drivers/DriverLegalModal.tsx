'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { tashkentToday } from '@/lib/compliance';
import { TAX_STATUS_LABELS, type DriverLegalErrors, type DriverLegalForm } from '@/lib/driver-legal';

const TAX_STATUS_OPTIONS = [
  { value: '', label: 'Kiritilmagan' },
  { value: 'self_employed', label: TAX_STATUS_LABELS.self_employed },
  { value: 'individual_entrepreneur', label: TAX_STATUS_LABELS.individual_entrepreneur },
];

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
  return (
    <Modal
      isOpen={!!form}
      onClose={saving ? () => undefined : onClose}
      title="Huquqiy profilni tahrirlash"
      description="Maʼlumotni hujjat (pasport, guvohnoma, litsenziya) bilan solishtirib kiriting. Boʻsh maydon — tozalanadi."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Bekor qilish
          </Button>
          <Button onClick={onSave} isLoading={saving}>
            Saqlash
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
            label="Soliq maqomi"
            options={TAX_STATUS_OPTIONS}
            value={form.taxStatus}
            onChange={(e) => onChange({ taxStatus: e.target.value as DriverLegalForm['taxStatus'] })}
          />
          <Input
            label="Fuqarolik"
            mono
            maxLength={2}
            value={form.citizenship}
            error={errors.citizenship}
            hint="ISO kod, masalan UZ"
            onChange={(e) => onChange({ citizenship: e.target.value.toUpperCase() })}
          />
          <Input
            label="JShShIR (PINFL)"
            mono
            inputMode="numeric"
            maxLength={14}
            placeholder="14 ta raqam"
            value={form.pinfl}
            error={errors.pinfl}
            onChange={(e) => onChange({ pinfl: digits(e.target.value) })}
          />
          <Input
            label="STIR (INN)"
            mono
            inputMode="numeric"
            maxLength={9}
            placeholder="9 ta raqam"
            value={form.tin}
            error={errors.tin}
            hint={form.taxStatus === 'individual_entrepreneur' ? 'YaTT uchun majburiy' : undefined}
            onChange={(e) => onChange({ tin: digits(e.target.value) })}
          />
          <Input
            label="Tugʻilgan sana"
            type="date"
            max={today}
            value={form.birthDate}
            error={errors.birthDate}
            onChange={(e) => onChange({ birthDate: e.target.value })}
          />
          <Input
            label="Guvohnoma berilgan sana (B toifa)"
            type="date"
            max={today}
            value={form.drivingLicenceIssuedAt}
            error={errors.drivingLicenceIssuedAt}
            onChange={(e) => onChange({ drivingLicenceIssuedAt: e.target.value })}
          />
          <Input
            label="Taksi litsenziya raqami"
            mono
            maxLength={50}
            value={form.taxiLicenceNumber}
            error={errors.taxiLicenceNumber}
            onChange={(e) => onChange({ taxiLicenceNumber: e.target.value })}
          />
          <Input
            label="Litsenziya hududi"
            maxLength={100}
            placeholder="Masalan: Toshkent viloyati"
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
