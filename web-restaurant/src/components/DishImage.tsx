'use client';

import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { cn } from '@/components/ui/cn';

export interface DishImageProps {
  src?: string | null;
  name: string;
  className?: string;
}

/**
 * Taom rasmi (`catalogImageSrc(dish.imageKey)`). Rasm bo'lmasa yoki
 * yuklanmasa sokin neytral plitka + ikonka chiziladi.
 *
 * `next/image` emas, oddiy `<img>`: rasm manbasi ixtiyoriy tashqi host
 * bo'lishi mumkin va `next.config.js` da remotePatterns e'lon qilinmagan.
 */
export function DishImage({ src, name, className }: DishImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className={cn('relative flex shrink-0 items-center justify-center overflow-hidden bg-surface-2', className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src as string} alt={name} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <UtensilsCrossed size={16} className="text-subtle" aria-hidden />
      )}
    </div>
  );
}
