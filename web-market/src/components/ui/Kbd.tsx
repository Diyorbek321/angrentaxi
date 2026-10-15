// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import type { ReactNode } from 'react';
import { cn } from './cn';

/** Keyboard hint: <Kbd>⌘K</Kbd>. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center h-5 px-1.5 rounded-ds-xs border border-line bg-surface-2',
        'font-sans text-[11px] font-medium text-muted leading-none',
        className
      )}
    >
      {children}
    </kbd>
  );
}
