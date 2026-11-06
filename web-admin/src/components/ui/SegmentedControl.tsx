// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { Tabs, type TabsProps } from './Tabs';

export type SegmentedControlProps<T extends string = string> = Omit<TabsProps<T>, 'variant'>;

/** Compact filter switch (Hammasi / Faol / Bloklangan). Same API as Tabs. */
export function SegmentedControl<T extends string = string>(props: SegmentedControlProps<T>) {
  return <Tabs {...props} variant="segmented" />;
}
