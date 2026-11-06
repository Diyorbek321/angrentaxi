// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { cn } from './cn';

/** "01A123AA" -> "01 A 123 AA" (Uzbek private plate); other shapes untouched. */
export function formatPlate(plate: string): string {
  const compact = plate.replace(/\s+/g, '').toUpperCase();
  const m = compact.match(/^(\d{2})([A-Z])(\d{3})([A-Z]{2})$/);
  if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  const legal = compact.match(/^(\d{2})(\d{3})([A-Z]{3})$/);
  if (legal) return `${legal[1]} ${legal[2]} ${legal[3]}`;
  return plate.trim().toUpperCase();
}

/** Licence plate chip — mono, one line, never wraps. */
export function PlateNumber({ plate, className }: { plate: string | null | undefined; className?: string }) {
  if (!plate) return <span className="text-subtle">—</span>;
  return (
    <span
      className={cn(
        'inline-flex items-center h-5 px-1.5 rounded-ds-xs border border-line-strong bg-surface',
        'font-mono text-xs font-medium text-ink whitespace-nowrap leading-none',
        className
      )}
    >
      {formatPlate(plate)}
    </span>
  );
}
