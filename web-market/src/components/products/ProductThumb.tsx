'use client';

import { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import type { Product } from '@/lib/api';
import { catalogImageSrc } from '@/lib/catalog-image';
import { hueTint } from '@/lib/utils';

/**
 * Jadvaldagi mahsulot belgisi: rasm bo'lsa rasm, bo'lmasa emoji. Bosilganda
 * rasm oynasi ochiladi — mahsulotning boshqa tahrirlash formasi yo'q.
 */
export function ProductThumb({ product: p, onClick }: { product: Product; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  const src = catalogImageSrc(p.imageKey);
  const showImage = Boolean(src) && !failed;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${p.name} rasmini o'zgartirish`}
      title="Rasmni o'zgartirish"
      style={showImage ? undefined : hueTint(p.hue)}
      className="group relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-ds-xs border border-line text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src as string} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{p.emoji}</span>
      )}
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center bg-ink/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <ImagePlus size={14} />
      </span>
    </button>
  );
}
