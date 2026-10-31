// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Class joiner for the kit: clsx + tailwind-merge taught about the preset's
 * custom font sizes / radii / shadows, so `text-micro` is a size (not a
 * colour) and a caller's `className="max-w-md"` really replaces a default.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'micro',
            'caption',
            'table',
            'label',
            'body',
            'body-lg',
            'title',
            'h3',
            'h2',
            'h1',
            'kpi',
            'display',
          ],
        },
      ],
      rounded: [{ rounded: ['ds-xs', 'ds-sm', 'ds-md', 'ds-lg', 'ds-xl'] }],
      shadow: [{ shadow: ['card', 'hairline', 'pop', 'cta', 'glow-mint', 'glow-primary', 'glow-mint-sm'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
