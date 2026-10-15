// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { Pagination, PAGE_SIZE_OPTIONS, type PaginationProps } from './Pagination';

export { PAGE_SIZE_OPTIONS };

/** web-admin name — same component as `Pagination` (range + size + pages). */
export type PaginationBarProps = PaginationProps;

export function PaginationBar(props: PaginationBarProps) {
  return <Pagination {...props} />;
}
