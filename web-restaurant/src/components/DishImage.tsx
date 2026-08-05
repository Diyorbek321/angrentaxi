'use client';

import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { clsx } from 'clsx';

export interface DishImageProps {
  src?: string | null;
  name: string;
  className?: string;
}

/**
 * Taom rasmi. Backend hozircha rasm URL'ini bermaydi (lib/api.ts dagi
 * `Dish.imageUrl` izohiga qarang), shuning uchun rasm bo'lmasa yoki
 * yuklanmasa dekorativ mint gradient chiziladi — u ma'no tashimaydi,
 * shuning uchun mint bo'lishi mumkin (DESIGN-TOKENS 3.4).
 *
 * `next/image` emas, oddiy `<img>`: rasm manbasi ixtiyoriy tashqi host
 * bo'lishi mumkin va `next.config.js` da remotePatterns e'lon qilinmagan.
 */
export function DishImage({ src, name, className }: DishImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={clsx(
        'relative flex items-center justify-center overflow-hidden bg-gradient-mint',
        className
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={name}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex flex-col items-center gap-1 text-ink/80" aria-hidden>
          <UtensilsCrossed size={26} />
          <span className="text-micro uppercase">{name.slice(0, 2)}</span>
        </span>
      )}
    </div>
  );
}
