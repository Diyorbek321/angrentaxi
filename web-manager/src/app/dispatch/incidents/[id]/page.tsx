'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, UserCheck } from 'lucide-react';
import { assignIncidentToMe, getIncident } from '@/lib/incidents-api';
import { getCurrentUserProfile } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error';
import { isActive, type IncidentDetail } from '@/lib/incidents';
import { Button } from '@/components/ui/Button';
import { PageBody } from '@/components/ui/PageBody';
import { PageHeader } from '@/components/ui/PageHeader';
import { DetailCard, KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { IncidentFlags, IncidentStatusBadge, categoryLabel } from '@/components/incidents/IncidentBadges';
import { IncidentEvidence, PartyCard } from '@/components/incidents/IncidentEvidence';
import { ResolveIncidentForm } from '@/components/incidents/ResolveIncidentForm';
import { formatDateTime, formatMoney } from '@/lib/format';
import { t } from '@/locales';

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const m = t().incidents;
  const d = m.detail;
  const { toast } = useToast();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    try {
      setIncident(await getIncident(id));
      setError(null);
    } catch {
      setError(t().incidents.detail.loadFailed);
    }
  }, [id]);

  useEffect(() => {
    void load();
    getCurrentUserProfile()
      .then((p) => setIsAdmin(p.role === 'admin'))
      .catch(() => setIsAdmin(false));
  }, [load]);

  const assign = async () => {
    setAssigning(true);
    try {
      await assignIncidentToMe(id);
      toast({ title: d.assigned, variant: 'success' });
      await load();
    } catch (err) {
      toast({ title: apiErrorMessage(err, d.assignFailed), variant: 'error' });
    } finally {
      setAssigning(false);
    }
  };

  if (error && !incident) {
    return (
      <PageBody width="narrow">
        <ErrorState title={error} onRetry={() => void load()} />
      </PageBody>
    );
  }
  if (!incident) {
    return (
      <PageBody width="narrow">
        <Skeleton className="h-7 w-56 mb-6" />
        <Skeleton className="h-60 rounded-ds-md" />
      </PageBody>
    );
  }

  const strikes = incident.strikes;
  return (
    <PageBody className="max-w-5xl">
      <Link href="/dispatch/incidents" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={14} aria-hidden /> {d.back}
      </Link>
      <PageHeader
        title={categoryLabel(incident.category)}
        description={formatDateTime(incident.createdAt)}
        actions={
          <span className="inline-flex items-center gap-2">
            <IncidentStatusBadge status={incident.status} />
            <IncidentFlags item={incident} />
            {incident.status === 'open' && (
              <Button size="sm" variant="secondary" onClick={() => void assign()} isLoading={assigning} leftIcon={<UserCheck size={13} aria-hidden />}>
                {d.assignToMe}
              </Button>
            )}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DetailCard title={d.complaint} className="md:col-span-2">
          <p className="whitespace-pre-wrap text-sm text-ink">{incident.description}</p>
          {incident.appealNote && (
            <div className="mt-3 rounded-ds-sm bg-surface-2 p-2 text-sm">
              <Badge variant="violet" size="sm">{d.appeal}</Badge> {incident.appealNote}
            </div>
          )}
        </DetailCard>

        <PartyCard title={d.reporter} party={incident.reporter} role={incident.reporterRole} />
        <PartyCard title={d.subject} party={incident.subject} role={incident.subjectRole} />

        <div className="md:col-span-2">
          <IncidentEvidence incident={incident} />
        </div>

        {strikes && (
          <DetailCard title={d.strikes}>
            <KeyValueList>
              <KeyValue label={d.strikes}>{d.strikesValue(strikes.confirmed, strikes.windowDays)}</KeyValue>
              <KeyValue label="—">
                <Badge variant={strikes.suggestion === 'escalate_block' ? 'danger' : strikes.suggestion === 'none' ? 'neutral' : 'warning'}>
                  {m.suggestion[strikes.suggestion]}
                </Badge>
              </KeyValue>
            </KeyValueList>
          </DetailCard>
        )}

        {incident.outcomes.length > 0 && (
          <DetailCard title={d.outcomesDone}>
            <ul className="flex flex-col gap-1 text-sm">
              {incident.outcomes.map((o, i) => (
                <li key={`${o.type}-${i}`}>
                  {m.outcomes[o.type]}
                  {o.amount ? ` · ${formatMoney(o.amount)}` : ''}
                  {o.until ? ` · ${formatDateTime(o.until)}` : ''}
                  {o.automatic ? ` · ${d.automatic}` : ''}
                  {o.liftedAt ? ` · ${d.lifted}` : ''}
                </li>
              ))}
            </ul>
            {incident.resolutionNote && <p className="mt-2 text-sm text-muted">{d.resolution}: {incident.resolutionNote}</p>}
          </DetailCard>
        )}

        {isActive(incident.status) && (
          <div className="md:col-span-2">
            <ResolveIncidentForm incident={incident} isAdmin={isAdmin} onResolved={() => void load()} />
          </div>
        )}
      </div>
    </PageBody>
  );
}
