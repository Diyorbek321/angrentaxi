import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Products carry an `emoji` + `hue` instead of an uploaded image (there is no
 * `image` field on the model), so the swatch behind the emoji is generated
 * from the hue.
 *
 * This is the one place inline styles are justified: the hue is per-product
 * data, so there is no Tailwind class to reach for. Both colours are
 * translucent, which keeps them readable over the light *and* dark surface
 * without the component having to know which theme is active.
 */
export function hueSwatch(hue: number): { backgroundColor: string; borderColor: string } {
  const h = ((hue % 360) + 360) % 360;
  return {
    backgroundColor: `hsl(${h} 70% 50% / 0.14)`,
    borderColor: `hsl(${h} 70% 50% / 0.28)`,
  };
}
