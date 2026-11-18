'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOrderIncidents } from '@/lib/incidents-api';
import { orderIncidentTargets, type IncidentItem, type IncidentVertical } from '@/lib/incidents';
import { DetailCard } from '@/components/ui/KeyValue';
import { formatDateTime } from '@/lib/format';
import { IncidentFlags, IncidentStatusBadge, categoryLabel, roleLabel } from './IncidentBadges';
import { t } from '@/locales';

/** Buyurtma sahifasidagi «Hodisalar» bo'limi (INCIDENT-POLICY tamoyil 3). */
export function OrderIncidentsSection({ order }: { order: { id: string; details?: Record<string, unknown> | null } }) {
  const m = t().incidents;
  const [items, setItems] = useState<IncidentItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const key = orderIncidentTargets(order)
    .map((target) => `${target.vertical}:${target.id}`)
    .join(',');

  useEffect(() => {
    let cancelled = false;
    const targets = key.split(',').map((pair) => {
      const [vertical, id] = pair.split(':');
      return { vertical: vertical as IncidentVertical, id };
    });
    Promise.all(targets.map((target) => getOrderIncidents(target.vertical, target.id)))
      .then((lists) => {
        if (!cancelled) setItems(lists.flat());
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <DetailCard title={m.order.title} className="md:col-span-2">
      {failed ? (
        <p className="text-[13px] text-subtle">{m.order.loadFailed}</p>
      ) : items === null ? (
        <p className="text-[13px] text-subtle">…</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-subtle">{m.order.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 py-2 text-[13px]">
              <Link href={`/dispatch/incidents/${item.id}`} className="font-medium text-primary-text hover:underline">
                {categoryLabel(item.category)}
              </Link>
              <span className="text-muted">
                {roleLabel(item.reporterRole)} → {roleLabel(item.subjectRole)}
              </span>
              <IncidentStatusBadge status={item.status} />
              <IncidentFlags item={item} />
              <span className="num ml-auto text-subtle">{formatDateTime(item.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  );
}
