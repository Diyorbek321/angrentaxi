'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { getIncidentPhotoUrl } from '@/lib/incidents-api';
import type { IncidentDetail, IncidentParty } from '@/lib/incidents';
import { DetailCard, KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime, formatPhone, shortId } from '@/lib/format';
import { categoryLabel, roleLabel } from './IncidentBadges';
import { t } from '@/locales';

/** Foto — cookie bilan blob; komponent yopilganda URL bo'shatiladi. */
function IncidentPhoto({ incidentId, index }: { incidentId: string; index: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    getIncidentPhotoUrl(incidentId, index)
      .then((u) => {
        objectUrl = u;
        if (!cancelled) setUrl(u);
      })
      .catch(() => setUrl(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [incidentId, index]);
  if (!url) return <div className="h-28 w-28 rounded-ds-sm bg-surface-2" aria-hidden />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-28 w-28 rounded-ds-sm object-cover border border-line" />
    </a>
  );
}

export function PartyCard({ title, party, role }: { title: string; party: IncidentParty | null; role: string | null }) {
  const d = t().incidents.detail;
  return (
    <DetailCard title={title}>
      {party ? (
        <KeyValueList>
          <KeyValue label={roleLabel(party.role ?? role)}>{party.name ?? '—'}</KeyValue>
          <KeyValue label={d.phone}>
            <span className="num">{party.phone ? formatPhone(party.phone) : '—'}</span>
          </KeyValue>
          {party.driverRating != null && (
            <KeyValue label={d.driverRating}>
              <span className="num inline-flex items-center gap-1">
                <Star size={12} aria-hidden /> {party.driverRating.toFixed(2)}
              </span>
            </KeyValue>
          )}
          {party.passengerRating != null && (
            <KeyValue label={d.passengerRating}>
              <span className="num">
                {party.passengerRating.toFixed(2)} ({party.passengerRatingCount})
              </span>
            </KeyValue>
          )}
          {party.suspendedUntil && new Date(party.suspendedUntil) > new Date() && (
            <KeyValue label={d.suspendedUntil}>
              <span className="num">{formatDateTime(party.suspendedUntil)}</span>
            </KeyValue>
          )}
        </KeyValueList>
      ) : (
        <p className="text-sm text-muted">{role === 'system' ? t().incidents.system : '—'}</p>
      )}
    </DetailCard>
  );
}

/** Dalillar bitta joyda (tamoyil 3): buyurtma, baholar, SOS, yo'qolgan buyum, foto. */
export function IncidentEvidence({ incident }: { incident: IncidentDetail }) {
  const m = t().incidents;
  const d = m.detail;
  const { evidence, order } = incident;
  const orderHref = order?.rideOrderId ? `/orders/${order.rideOrderId}` : null;
  return (
    <DetailCard title={d.evidence}>
      <KeyValueList>
        <KeyValue label={d.order}>
          {order ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {m.verticals[order.vertical]} · <span className="num">{shortId(order.orderId)}</span>
              {order.vendorName && <span className="text-muted">{order.vendorName}</span>}
              {orderHref && (
                <Link href={orderHref} className="text-primary-text hover:underline">
                  {d.openOrder}
                </Link>
              )}
            </span>
          ) : (
            '—'
          )}
        </KeyValue>
        <KeyValue label={d.ratings}>
          {evidence.ratings.length === 0
            ? d.noEvidence
            : evidence.ratings.map((r) => (
                <div key={r.id} className="text-sm">
                  {roleLabel(r.fromRole)}: <span className="num">{r.score}★</span> {r.comment ? `— ${r.comment}` : ''}
                </div>
              ))}
        </KeyValue>
        <KeyValue label={d.sos}>
          {evidence.sos.length === 0
            ? d.noEvidence
            : evidence.sos.map((s) => (
                <div key={s.id} className="text-sm">
                  <Badge variant="danger" size="sm">SOS</Badge> {roleLabel(s.reportedByRole)} ·{' '}
                  <span className="num">{formatDateTime(s.createdAt)}</span> · {s.status}
                </div>
              ))}
        </KeyValue>
        <KeyValue label={d.lostItems}>
          {evidence.lostItems.length === 0
            ? d.noEvidence
            : evidence.lostItems.map((l) => (
                <div key={l.id} className="text-sm">
                  {l.description} · {l.status}
                </div>
              ))}
        </KeyValue>
        <KeyValue label={d.photos}>
          {evidence.photoCount === 0 ? (
            d.noEvidence
          ) : (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: evidence.photoCount }).map((_, i) => (
                <IncidentPhoto key={i} incidentId={incident.id} index={i} />
              ))}
            </div>
          )}
        </KeyValue>
        {incident.subjectHistory.length > 0 && (
          <KeyValue label={d.history}>
            {incident.subjectHistory.map((h) => (
              <div key={h.id} className="text-sm">
                <Link href={`/dispatch/incidents/${h.id}`} className="text-primary-text hover:underline">
                  {categoryLabel(h.category)}
                </Link>{' '}
                · {m.statuses[h.status]} {h.confirmedAgainstSubject ? '✓' : ''} ·{' '}
                <span className="num">{formatDateTime(h.createdAt)}</span>
              </div>
            ))}
          </KeyValue>
        )}
      </KeyValueList>
    </DetailCard>
  );
}
