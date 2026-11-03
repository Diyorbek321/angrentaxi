'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { incidentsApi, type MyIncident, type IncidentStatus } from '@/lib/incidents';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageBody } from '@/components/ui/PageBody';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatTime, shortId } from '@/lib/format';
import { t } from '@/locales';

const VARIANT: Record<IncidentStatus, BadgeVariant> = {
  open: 'info',
  investigating: 'neutral',
  resolved: 'success',
  rejected: 'muted-danger',
};

/** "Murojaatlarim" — sotuvchi yozgan xabarlar va natijasi (INCIDENT-POLICY §3). */
export default function IncidentsPage() {
  const m = t().incidents;
  const [items, setItems] = useState<MyIncident[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await incidentsApi.mine();
      setItems(res.data.data);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageBody>
      <PageHeader title={m.pageTitle} description={m.pageDescription} />
      {failed && !items ? (
        <Card padding="none">
          <ErrorState title={m.loadFailed} onRetry={() => void load()} />
        </Card>
      ) : !items ? (
        <Skeleton className="h-32 rounded-ds-md" />
      ) : items.length === 0 ? (
        <Card padding="none">
          <EmptyState icon={<Flag aria-hidden />} title={m.empty} />
        </Card>
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{m.categories[item.category] ?? item.category}</span>
                  <Badge variant={VARIANT[item.status]} size="sm">
                    {m.statuses[item.status]}
                  </Badge>
                  <span className="num ml-auto text-xs text-muted">
                    {m.order} {item.orderId ? shortId(item.orderId) : '—'} · {formatTime(item.createdAt)}
                  </span>
                </div>
                <p className="text-body text-muted">{item.description}</p>
                {item.resolutionNote && (
                  <p className="text-body text-ink">
                    {m.resolution}: {item.resolutionNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageBody>
  );
}
