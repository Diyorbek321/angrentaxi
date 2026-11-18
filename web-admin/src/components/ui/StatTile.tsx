// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { StatCard, type StatCardProps, type StatTone } from './StatCard';

export type { StatTone };

/** Backward-compatible alias of StatCard (manager/market/restaurant call sites). */
export interface StatTileProps extends Omit<StatCardProps, 'label'> {
  label: string;
}

/** Dense StatCard (`size="sm"` by default). Prefer `StatCard` in new code. */
export function StatTile({ size = 'sm', ...props }: StatTileProps) {
  return <StatCard size={size} {...props} />;
}
