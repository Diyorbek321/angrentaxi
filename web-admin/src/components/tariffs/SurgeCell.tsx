'use client';

import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Badge, Button, IconButton, Input } from '@/components/ui';
import { tariffsApi, type Tariff } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export const SURGE_MIN = 1;
export const SURGE_MAX = 3;

export function validateSurge(raw: string): string | null {
  const value = parseFloat(raw);
  if (Number.isNaN(value) || value < SURGE_MIN || value > SURGE_MAX) {
    return `${SURGE_MIN.toFixed(1)} dan ${SURGE_MAX.toFixed(1)} gacha bo'lishi kerak`;
  }
  return null;
}

interface SurgeCellProps {
  tariff: Tariff;
  onSaved: (tariff: Tariff) => void;
}

/**
 * Inline surge edit: pencil → input + ✓/✕. Explicit save, Enter/Esc, the
 * validation error attaches to the field itself (no modal, no toast).
 * A raised multiplier is a human override of the normal price → amber.
 */
export function SurgeCell({ tariff, onSaved }: SurgeCellProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorId = `surge-error-${tariff.id}`;

  const start = () => {
    setEditing(true);
    setValue(String(tariff.surgeMultiplier));
    setError(null);
  };

  const cancel = () => {
    setEditing(false);
    setValue('');
    setError(null);
  };

  const apply = async () => {
    const validation = validateSurge(value);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    try {
      const res = await tariffsApi.setSurge(tariff.id, parseFloat(value));
      onSaved(res.data.data);
      cancel();
      toast({ title: 'Narx koeffitsienti yangilandi', variant: 'success' });
    } catch {
      setError("Saqlashda xatolik — qayta urinib ko'ring");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    const raised = tariff.surgeMultiplier > 1;
    return (
      <div className="inline-flex items-center justify-end gap-1">
        {raised ? (
          <Badge variant="warning" className="num">
            {tariff.surgeMultiplier.toFixed(1)}x
          </Badge>
        ) : (
          <span className="num text-muted">{tariff.surgeMultiplier.toFixed(1)}x</span>
        )}
        <IconButton size="sm" aria-label={`${tariff.name} narx koeffitsientini tahrirlash`} onClick={start}>
          <Pencil aria-hidden />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-end gap-1 py-1">
      <div className="flex items-center gap-1">
        <Input
          type="number"
          size="sm"
          min={SURGE_MIN}
          max={SURGE_MAX}
          step={0.1}
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(validateSurge(e.target.value));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void apply();
            }
            if (e.key === 'Escape') cancel();
          }}
          aria-label={`${tariff.name} narx koeffitsienti`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          wrapperClassName="w-20"
        />
        <Button
          size="icon-sm"
          variant="primary"
          isLoading={saving}
          disabled={!!validateSurge(value)}
          onClick={() => void apply()}
          aria-label="Koeffitsientni saqlash"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button size="icon-sm" variant="secondary" disabled={saving} onClick={cancel} aria-label="Tahrirni bekor qilish">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
      <p
        id={errorId}
        className={error ? 'text-xs text-danger-dark dark:text-danger-light' : 'num text-xs text-subtle'}
      >
        {error ?? `${SURGE_MIN.toFixed(1)}–${SURGE_MAX.toFixed(1)} · Enter — saqlash`}
      </p>
    </div>
  );
}
