'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { foodAdminApi, marketAdminApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error';
import { isTinChanged, parseTinInput } from '@/lib/vendor-tin';
import { t } from '@/locales';

export interface VendorTinTarget {
  kind: 'stores' | 'restaurants';
  id: string;
  name: string;
  tin: string | null | undefined;
}

export interface VendorTinModalProps {
  target: VendorTinTarget | null;
  onClose: () => void;
  onSaved: (kind: VendorTinTarget['kind'], id: string, tin: string | null) => void;
}

/**
 * Sotuvchi STIR'ini admin tahrirlashi (LEGAL-COMPLIANCE §23). Fiskal chekda
 * komitent STIR'i sifatida ketadi; o'zgarish `vendor.tin_update` bo'lib
 * amallar jurnaliga yoziladi.
 */
export function VendorTinModal({ target, onClose, onSaved }: VendorTinModalProps) {
  const m = t();
  const tm = m.vendors.tin;
  const { toast } = useToast();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(target?.tin ?? '');
    setError(undefined);
  }, [target]);

  const save = async () => {
    if (!target) return;
    const parsed = parseTinInput(value);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (!isTinChanged(target.tin, parsed.tin)) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const api = target.kind === 'stores' ? marketAdminApi : foodAdminApi;
      const res = await api.setTin(target.id, parsed.tin);
      const saved = res.data.data?.tin ?? parsed.tin;
      onSaved(target.kind, target.id, saved);
      toast({
        title: saved ? tm.saved : tm.removed,
        description: tm.savedDesc(target.name),
        variant: 'success',
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, tm.saveFailed));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title={tm.title}
      description={target ? tm.description(target.name) : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {m.common.cancel}
          </Button>
          <Button onClick={save} isLoading={saving}>
            {m.common.save}
          </Button>
        </>
      }
    >
      <Input
        label={tm.label}
        placeholder="123456789"
        inputMode="numeric"
        autoComplete="off"
        mono
        maxLength={11}
        value={value}
        error={error}
        hint={tm.hint}
        onChange={(e) => {
          setValue(e.target.value);
          setError(undefined);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
        }}
      />
    </Modal>
  );
}
