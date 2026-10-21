'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { catalogImageSrc } from '@/lib/catalog-image';
import { t } from '@/locales';

/**
 * Moderatsiya jadvalidagi taom/mahsulot rasmi. Bosilsa asl o'lchamda yangi
 * oynada ochiladi — moderator rasmni yaqindan ko'rib, nomaqbul kontentni
 * aniqlashi kerak. Rasm yo'q yoki yuklanmasa neytral belgi chiziladi.
 */
export function CatalogThumb({ imageKey, name }: { imageKey?: string | null; name: string }) {
  const m = t().moderation.thumb;
  const [failed, setFailed] = useState(false);
  const src = catalogImageSrc(imageKey);

  if (!src || failed) {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-xs border border-line bg-surface-2 text-subtle"
        title={m.noImage}
        aria-label={m.noImage}
      >
        <ImageOff className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      title={m.zoom}
      aria-label={m.zoomAria(name)}
      className="block h-8 w-8 shrink-0 overflow-hidden rounded-ds-xs border border-line focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
    </a>
  );
}
