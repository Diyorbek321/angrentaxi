'use client';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { isPendingAppeal, slaTone, type IncidentItem, type IncidentStatus } from '@/lib/incidents';
import { t } from '@/locales';

const STATUS_VARIANT: Record<IncidentStatus, BadgeVariant> = {
  open: 'info',
  investigating: 'neutral',
  resolved: 'success',
  rejected: 'muted-danger',
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{t().incidents.statuses[status]}</Badge>;
}

/** SLA (ochiq holatda) + admin / e'tiroz / xavfsizlik belgilari. */
export function IncidentFlags({ item }: { item: IncidentItem }) {
  const m = t().incidents;
  const sla = slaTone(item);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {sla && (
        <Badge variant={sla === 'late' ? 'danger' : sla === 'warn' ? 'warning' : 'neutral'} size="sm" dot>
          {m.hoursAgo(item.ageHours)}
        </Badge>
      )}
      {item.safetySuspended && item.status !== 'resolved' && item.status !== 'rejected' && (
        <Badge variant="danger" size="sm">{m.safety}</Badge>
      )}
      {isPendingAppeal(item) && <Badge variant="violet" size="sm">{m.appealPending}</Badge>}
      {item.escalatedToAdmin && <Badge variant="warning" size="sm">{m.needsAdmin}</Badge>}
    </span>
  );
}

export function categoryLabel(category: string): string {
  return t().incidents.categories[category] ?? category;
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return t().incidents.roles[role] ?? role;
}
