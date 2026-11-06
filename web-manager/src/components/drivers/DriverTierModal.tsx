'use client';

import { useEffect, useState } from 'react';
import { setDriverTariffTier, DriverProfile, TARIFF_TIERS } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { fullName } from '@/lib/format';
import { t } from '@/locales';

export function tierLabel(tier: number): string {
  const names: Record<number, string> = t().drivers.tier.names;
  return names[tier] ?? TARIFF_TIERS.find((item) => item.tier === tier)?.label ?? String(tier);
}

export interface DriverTierModalProps {
  driver: DriverProfile | null;
  onClose: () => void;
  onUpdated: (driver: DriverProfile) => void;
}

/** The highest tariff tier this driver's car has been vetted for. */
export function DriverTierModal({ driver, onClose, onUpdated }: DriverTierModalProps) {
  const m = t();
  const tm = m.drivers.tier;
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
        title: tm.savedTitle(tierLabel(tier)),
        description: tm.savedDesc(fullName(updated.firstName, updated.lastName)),
        variant: 'success',
      });
    } catch (err) {
      console.error('Set tariff tier failed:', err);
      toast({ title: tm.saveError, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={!!driver}
      onClose={onClose}
      title={
        driver ? tm.modalTitle(fullName(driver.firstName, driver.lastName)) : tm.label
      }
      size="sm"
    >
      {driver && (
        <div className="space-y-4">
          <p className="text-xs text-muted leading-relaxed">
            {tm.hint(driver.carYear)}
          </p>
          <Select
            label={tm.label}
            options={TARIFF_TIERS.map((item) => ({ value: String(item.tier), label: tierLabel(item.tier) }))}
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
            {m.common.save}
          </Button>
        </div>
      )}
    </Modal>
  );
}
