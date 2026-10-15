// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Scroll container + standard page padding (PANEL-UI-KIT §4: px-6 py-5).
 * The shell's <main> is `overflow-hidden` so the live map can be full-bleed;
 * every other page scrolls inside this wrapper.
 */
export function PageBody({
  children,
  className,
  width = 'full',
}: {
  children: ReactNode;
  className?: string;
  /** `narrow` for forms and detail pages, `full` for tables and dashboards. */
  width?: 'full' | 'narrow';
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={cn('px-4 sm:px-6 py-5', width === 'narrow' && 'max-w-4xl', className)}>
        {children}
      </div>
    </div>
  );
}
