// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import type { ReactNode } from 'react';
import { Card, CardBody, CardHeader } from './Card';
import { cn } from './cn';

/** Detail-page section: Card with a 15px title and a padded body. */
export function DetailCard({
  title,
  actions,
  className,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card padding="none" className={className}>
      <CardHeader title={title} actions={actions} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

/** Key-value list: label left (muted), value right. Hairline between rows. */
export function KeyValueList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('divide-y divide-line', className)}>{children}</dl>;
}

export function KeyValue({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-[13px] first:pt-0 last:pb-0">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-ink text-right min-w-0 break-words">{children}</dd>
    </div>
  );
}
