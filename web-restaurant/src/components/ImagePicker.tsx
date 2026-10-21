'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { ImagePlus, Trash2, Undo2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { CATALOG_IMAGE_TYPES, ImageChange, validateCatalogImage } from '@/lib/catalog-image';
import { t } from '@/locales';

export interface ImagePickerProps {
  label: string;
  /** Hozir saqlangan rasm manzili (yo'q bo'lsa null). */
  currentSrc: string | null;
  value: ImageChange;
  onChange: (next: ImageChange) => void;
  /** Ko'rinish nisbati, masalan `aspect-[4/3]`. */
  aspectClassName?: string;
}

/**
 * Formadagi rasm maydoni. Faylni o'zi yubormaydi — faqat tanlovni
 * ([ImageChange]) qaytaradi; forma saqlanganda chaqiruvchi yuklaydi.
 */
export function ImagePicker({
  label,
  currentSrc,
  value,
  onChange,
  aspectClassName = 'aspect-[4/3]',
}: ImagePickerProps) {
  const m = t();
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);

  const pickedUrl = useMemo(
    () => (value.kind === 'set' ? URL.createObjectURL(value.file) : null),
    [value]
  );
  useEffect(() => () => {
    if (pickedUrl) URL.revokeObjectURL(pickedUrl);
  }, [pickedUrl]);

  const previewSrc = value.kind === 'set' ? pickedUrl : value.kind === 'remove' ? null : currentSrc;
  const changed = value.kind !== 'keep';

  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = validateCatalogImage(file);
    setError(problem);
    if (!problem) onChange({ kind: 'set', file });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <label
        htmlFor={inputId}
        className={clsx(
          'flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-ds-sm',
          'border border-dashed border-line-strong bg-surface-2 text-muted transition-colors',
          'hover:border-line-strong hover:bg-surface-3/50 focus-within:ring-2 focus-within:ring-focus',
          aspectClassName
        )}
      >
        {previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs">
            <ImagePlus size={24} aria-hidden />
            {m.image.pick}
          </span>
        )}
        <input
          id={inputId}
          type="file"
          accept={CATALOG_IMAGE_TYPES.join(',')}
          className="sr-only"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            // Bir xil faylni qayta tanlash ham `onChange` bersin.
            e.target.value = '';
          }}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {changed && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<Undo2 size={14} />}
            onClick={() => {
              setError(null);
              onChange({ kind: 'keep' });
            }}
          >
            {m.common.cancel}
          </Button>
        )}
        {previewSrc && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<Trash2 size={14} />}
            onClick={() => onChange(currentSrc ? { kind: 'remove' } : { kind: 'keep' })}
          >
            {m.image.remove}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger-dark dark:text-danger-light">
          {error}
        </p>
      )}
    </div>
  );
}
