import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Products carry an `emoji` + `hue` instead of an uploaded image (there is no
 * `image` field on the model), so the swatch behind the emoji is generated
 * from the hue. Kept at a low saturation/high lightness so the emoji stays
 * legible and a wall of products never turns into a rainbow.
 */
export function hueTint(hue: number, dark: boolean): string {
  const h = ((hue % 360) + 360) % 360;
  return dark ? `hsl(${h} 42% 16%)` : `hsl(${h} 72% 93%)`;
}

/** Matching border for the tint above. */
export function hueBorder(hue: number, dark: boolean): string {
  const h = ((hue % 360) + 360) % 360;
  return dark ? `hsl(${h} 35% 26%)` : `hsl(${h} 55% 84%)`;
}
