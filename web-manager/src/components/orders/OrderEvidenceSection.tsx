'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ShieldAlert, Star } from 'lucide-react';
import { evidenceIsEmpty, getOrderEvidence, trackDistanceKm, trackPolyline, type OrderEvidence } from '@/lib/safety';
import { DetailCard } from '@/components/ui/KeyValue';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDateTime } from '@/lib/format';
import { categoryLabel } from '@/components/incidents/IncidentBadges';
import { t } from '@/locales';

// Leaflet SSR'da `window` ga tegadi — faqat brauzerda yuklanadi.
const EvidenceMapInner = dynamic(() => import('./EvidenceMapInner'), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full rounded-ds-md" />,
});

function Heading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-micro uppercase text-subtle mt-4 mb-2">{children}</h4>;
}

/**
 * Buyurtma "Dalillar" bo'limi (INCIDENT-POLICY tamoyil 3, §4). Ataylab
 * bosilganda yuklanadi: har ko'rish serverda audit yozuvi, sahifani ochgan
 * har menejer "dalil ko'rdi" deb yozilmasin.
 */
export function OrderEvidenceSection({ orderId }: { orderId: string }) {
  const m = t().safety.evidence;
  const [evidence, setEvidence] = useState<OrderEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      setEvidence(await getOrderEvidence(orderId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const points = useMemo(() => (evidence ? trackPolyline(evidence.track) : []), [evidence]);
  const sosPoints = useMemo(
    () => (evidence ? evidence.sos.map((s) => [s.lat, s.lng] as [number, number]) : []),
    [evidence],
  );
  const role = (r: string) => m.roles[r] ?? r;

  return (
    <DetailCard title={m.title} className="md:col-span-2">
      {!evidence && (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-[13px] text-muted">{m.hint}</p>
          {failed && <p className="text-[13px] text-danger-deep dark:text-danger-light">{m.loadFailed}</p>}
          <Button size="sm" variant="secondary" onClick={() => void load()} isLoading={loading}>
            {failed ? m.retry : m.show}
          </Button>
        </div>
      )}

      {evidence && evidenceIsEmpty(evidence) && <p className="text-[13px] text-muted">{m.empty}</p>}

      {evidence && !evidenceIsEmpty(evidence) && (
        <div>
          <Heading>{m.track}</Heading>
          {points.length > 0 || sosPoints.length > 0 ? (
            <>
              <EvidenceMapInner points={points} sos={sosPoints} />
              <p className="num text-xs text-muted mt-1">
                {m.trackSummary(points.length, trackDistanceKm(points))}
                {evidence.trackTruncated && ` · ${m.trackTruncated}`}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted">{m.noTrack}</p>
          )}

          <Heading>{m.chat}</Heading>
          {evidence.chat.length === 0 ? (
            <p className="text-[13px] text-muted">{m.noChat}</p>
          ) : (
            <ol className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
              {evidence.chat.map((msg) => (
                <li key={msg.id} className="text-[13px]">
                  <span className="font-medium text-ink">{role(msg.senderRole)}</span>{' '}
                  <span className="num text-[11px] text-subtle">{formatDateTime(msg.createdAt)}</span>
                  <p className="text-ink whitespace-pre-wrap break-words">{msg.body}</p>
                </li>
              ))}
            </ol>
          )}

          {evidence.sos.length > 0 && (
            <>
              <Heading>{m.sos}</Heading>
              <ul className="flex flex-col gap-1.5">
                {evidence.sos.map((s) => (
                  <li key={s.id} className="text-[13px] flex items-start gap-2">
                    <ShieldAlert size={14} className="text-danger mt-0.5 shrink-0" aria-hidden />
                    <span>
                      {role(s.reportedByRole)} · <span className="num">{formatDateTime(s.createdAt)}</span> ·{' '}
                      {s.status === 'resolved' ? m.sosResolved(s.resolutionNote ?? '—') : <Badge variant="danger" size="sm">{m.sosActive}</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {evidence.ratings.length > 0 && (
            <>
              <Heading>{m.ratings}</Heading>
              <ul className="flex flex-col gap-1.5">
                {evidence.ratings.map((r, i) => (
                  <li key={i} className="text-[13px] flex items-start gap-2">
                    <Star size={14} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      {role(r.fromRole)} · <span className="num">{r.score}★</span>
                      {r.comment ? ` · ${r.comment}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {evidence.calls.length > 0 && (
            <>
              <Heading>{m.calls}</Heading>
              <ul className="flex flex-col gap-1">
                {evidence.calls.map((c, i) => (
                  <li key={i} className="text-[13px]">
                    {c.calleeType === 'recipient' ? m.callRecipient(role(c.callerRole)) : m.callBy(role(c.callerRole))} · <span className="num">{formatDateTime(c.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {evidence.incidents.length > 0 && (
            <>
              <Heading>{m.incidents}</Heading>
              <ul className="flex flex-col gap-1">
                {evidence.incidents.map((i) => (
                  <li key={i.id} className="text-[13px]">
                    <Link className="text-primary-text underline" href={`/dispatch/incidents/${i.id}`}>
                      {categoryLabel(i.category)}
                    </Link>{' '}
                    · <span className="num">{formatDateTime(i.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </DetailCard>
  );
}
