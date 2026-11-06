'use client';

import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { t } from '@/locales';

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
  const m = t();
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
      setFieldError(m.products.enterNumber);
      return;
    }
    if (num < min) {
      setFieldError(m.products.atLeast(min));
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
        aria-label={m.products.editAria(ariaLabel)}
        title={m.common.edit}
        className="group ml-auto flex h-7 items-center justify-end gap-1 rounded-ds-xs px-1.5 text-right transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span className={cn('num text-[13px] font-medium', valueClassName ?? 'text-ink')}>{display}</span>
        {unit && <span className="shrink-0 text-xs text-muted">{unit}</span>}
        <Pencil
          size={12}
          aria-hidden
          className="shrink-0 text-subtle opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </button>
    );
  }

  return (
    <div className="ml-auto w-full max-w-[180px]">
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
          className={cn(
            'num h-7 w-full min-w-0 rounded-ds-sm border bg-surface px-2 text-right text-[13px] text-ink',
            'focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus',
            fieldError ? 'border-danger' : 'border-line'
          )}
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          aria-label={m.common.save}
          title={m.common.save}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ds-sm bg-primary text-white transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-45"
        >
          <Check size={14} aria-hidden />
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          aria-label={m.common.cancel}
          title={m.common.cancel}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ds-sm border border-line text-muted transition-colors hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-45"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      {fieldError && (
        <p role="alert" className="mt-1 text-right text-xs text-danger-dark dark:text-danger-light">
          {fieldError}
        </p>
      )}
    </div>
  );
}
