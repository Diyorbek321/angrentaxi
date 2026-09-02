'use client';

import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { clsx } from 'clsx';

export interface InlineEditCellProps {
  value: number;
  /** Ko'rsatish rejimidagi formatlangan qiymat (masalan "12 500"). */
  display: string;
  ariaLabel: string;
  /** Qiymat yonidagi birlik ("so'm", "dona"...). */
  unit?: string;
  min?: number;
  onSave: (value: number) => Promise<void>;
  valueClassName?: string;
}

/**
 * Bitta maydonli inline tahrir: qalam belgisi DOIMIY ko'rinib turadi
 * (hover planshetda yo'q), saqlash/bekor qilish aniq ✓/✕ tugmalar bilan,
 * validatsiya xatosi maydonning o'ziga yopishadi. Operator katakni "paypaslab"
 * tahrirlanishini topmasligi kerak.
 */
export function InlineEditCell({
  value,
  display,
  ariaLabel,
  unit,
  min = 0,
  onSave,
  valueClassName,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(String(value));
    setFieldError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setFieldError(null);
  };

  const save = async () => {
    const num = Number(draft);
    if (draft.trim() === '' || Number.isNaN(num)) {
      setFieldError('Raqam kiriting');
      return;
    }
    if (num < min) {
      setFieldError(`Kamida ${min}`);
      return;
    }
    if (num === value) {
      cancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(num);
      setEditing(false);
      setFieldError(null);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        aria-label={`${ariaLabel} — tahrirlash`}
        title="Tahrirlash"
        className="group flex w-full items-center justify-end gap-1.5 rounded-ds-xs px-1.5 py-1 text-right transition-colors duration-fast hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <span className={clsx('font-mono text-body tabular-nums font-bold', valueClassName ?? 'text-ink')}>
          {display}
        </span>
        {unit && <span className="shrink-0 text-caption text-muted">{unit}</span>}
        <Pencil
          size={12}
          aria-hidden
          className="shrink-0 text-subtle transition-colors duration-fast group-hover:text-ink"
        />
      </button>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-1">
        <input
          type="number"
          autoFocus
          value={draft}
          min={min}
          aria-label={ariaLabel}
          aria-invalid={fieldError ? true : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setFieldError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
            if (e.key === 'Escape') cancel();
          }}
          className={clsx(
            'h-8 w-full min-w-0 rounded-ds-xs border bg-surface px-2 text-right font-mono text-body tabular-nums text-ink',
            'focus:outline-none focus:ring-2 focus:ring-focus/35 focus:border-focus',
            fieldError ? 'border-danger/60' : 'border-line'
          )}
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          aria-label="Saqlash"
          title="Saqlash"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-xs bg-primary text-white transition-colors duration-fast hover:bg-primary-hover disabled:opacity-45"
        >
          <Check size={14} aria-hidden />
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          aria-label="Bekor qilish"
          title="Bekor qilish"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-xs border border-line text-muted transition-colors duration-fast hover:bg-surface-2 hover:text-ink disabled:opacity-45"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      {fieldError && (
        <p role="alert" className="mt-1 text-right text-caption font-semibold text-danger-deep dark:text-danger-light">
          {fieldError}
        </p>
      )}
    </div>
  );
}
