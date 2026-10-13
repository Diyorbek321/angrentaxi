'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { catalogImageSrc } from '@/lib/catalog-image';

/**
 * Moderatsiya jadvalidagi taom/mahsulot rasmi. Bosilsa asl o'lchamda yangi
 * oynada ochiladi — moderator rasmni yaqindan ko'rib, nomaqbul kontentni
 * aniqlashi kerak. Rasm yo'q yoki yuklanmasa neytral belgi chiziladi.
 */
export function CatalogThumb({ imageKey, name }: { imageKey?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = catalogImageSrc(imageKey);

  if (!src || failed) {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-sm bg-surface-2 text-muted"
        title="Rasm yo'q"
        aria-label="Rasm yo'q"
      >
        <ImageOff className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      title="Rasmni kattalashtirib ko'rish"
      aria-label={`${name} rasmini kattalashtirib ko'rish`}
      className="block h-10 w-10 shrink-0 overflow-hidden rounded-ds-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
    </a>
  );
}
