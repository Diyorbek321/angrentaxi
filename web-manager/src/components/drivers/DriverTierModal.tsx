'use client';

import { useEffect, useState } from 'react';
import { setDriverTariffTier, DriverProfile, TARIFF_TIERS } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

export function tierLabel(tier: number): string {
  return TARIFF_TIERS.find((t) => t.tier === tier)?.label ?? String(tier);
}

export interface DriverTierModalProps {
  driver: DriverProfile | null;
  onClose: () => void;
  onUpdated: (driver: DriverProfile) => void;
}

/** The highest tariff tier this driver's car has been vetted for. */
export function DriverTierModal({ driver, onClose, onUpdated }: DriverTierModalProps) {
  const { toast } = useToast();
  const [tier, setTier] = useState(driver?.approvedTariffTier ?? 1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTier(driver?.approvedTariffTier ?? 1);
  }, [driver]);

  const handleSave = async () => {
    if (!driver) return;
    setSaving(true);
    try {
      const updated = await setDriverTariffTier(driver.id, tier);
      onUpdated(updated);
      onClose();
      toast({
        title: `Tarif darajasi: ${tierLabel(tier)}`,
        description: `${updated.firstName} ${updated.lastName} shu darajagacha buyurtma oladi.`,
        variant: 'success',
      });
    } catch (err) {
      console.error('Set tariff tier failed:', err);
      toast({ title: 'Tarif darajasini yangilab boʻlmadi', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={!!driver}
      onClose={onClose}
      title={
        driver ? `${driver.firstName} ${driver.lastName} — tarif darajasi` : 'Tarif darajasi'
      }
      size="sm"
    >
      {driver && (
        <div className="space-y-4">
          <p className="text-xs text-muted leading-relaxed">
            Bu haydovchi qatnasha oladigan eng yuqori tarif — mashinasi
            {driver.carYear != null ? ` (${driver.carYear}-yil)` : ''} koʻrib chiqilgach
            belgilanadi.
          </p>
          <Select
            label="Tarif darajasi"
            options={TARIFF_TIERS.map((t) => ({ value: String(t.tier), label: t.label }))}
            value={String(tier)}
            onChange={(e) => setTier(Number(e.target.value))}
          />
          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            isLoading={saving}
            className="w-full"
          >
            Saqlash
          </Button>
        </div>
      )}
    </Modal>
  );
}
