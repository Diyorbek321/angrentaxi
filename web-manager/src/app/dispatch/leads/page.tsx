'use client';

import { useCallback, useEffect, useState } from 'react';
import { Inbox, RefreshCw } from 'lucide-react';
import { getLeads, Lead, LeadStatus, LeadType, updateLead } from '@/lib/api';
import { isLeadFinal, leadDetailEntries } from '@/lib/leads';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { PageBody } from '@/components/ui/PageBody';
import { ContactBlock } from '@/components/dispatch/ContactBlock';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/format';
import { t } from '@/locales';

type TypeFilter = 'all' | LeadType;
type StatusFilter = 'all' | LeadStatus;

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<LeadStatus, BadgeVariant> = {
  new: 'info',
  contacted: 'neutral',
  accepted: 'success',
  rejected: 'neutral',
};

/**
 * Saytdan kelgan arizalar. Menejer qo'ng'iroq qiladi va holatni belgilaydi;
 * qabul qilingan haydovchi keyin oddiy ilova + KYC oqimidan o'tadi.
 */
export default function LeadsPage() {
  const m = t();
  const ml = m.control.leads;
  const { toast } = useToast();
  const [type, setType] = useState<TypeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('new');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ lead: Lead; status: LeadStatus } | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getLeads({
        type: type === 'all' ? undefined : type,
        status: status === 'all' ? undefined : status,
        page,
        limit: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      setError(t().control.leads.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, [type, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (lead: Lead, next: LeadStatus) => {
    setEditing({ lead, status: next });
    setNote(lead.note ?? '');
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateLead(editing.lead.id, editing.status, note);
      toast({ title: ml.saved, variant: 'success' });
      setEditing(null);
      await load();
    } catch {
      toast({ title: ml.saveFailed, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const typeTabs = (['all', 'driver', 'courier', 'partner'] as const).map((v) => ({ value: v, label: ml.types[v] }));
  const statusTabs = (['new', 'contacted', 'accepted', 'rejected', 'all'] as const).map((v) => ({
    value: v,
    label: ml.statuses[v],
  }));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageBody className="max-w-5xl">
      <PageHeader
        title={ml.title}
        description={ml.description}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            isLoading={isLoading && hasLoadedOnce}
            leftIcon={<RefreshCw size={13} aria-hidden />}
          >
            {m.common.refresh}
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <SegmentedControl
          items={typeTabs}
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          ariaLabel={ml.typeAria}
        />
        <SegmentedControl
          items={statusTabs}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          ariaLabel={ml.statusAria}
        />
      </div>

      {error && hasLoadedOnce && (
        <RetryBanner message={error} onRetry={() => void load()} keepsLastData className="mb-3" />
      )}

      {error && !hasLoadedOnce ? (
        <Card padding="none">
          <ErrorState title={error} onRetry={() => void load()} retrying={isLoading} />
        </Card>
      ) : isLoading && !hasLoadedOnce ? (
        <SkeletonCards count={3} height="h-[110px]" />
      ) : items.length === 0 ? (
        <Card padding="none">
          <EmptyState icon={<Inbox aria-hidden />} title={ml.emptyTitle} description={ml.emptyDescription} />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((lead) => (
            <Card key={lead.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{ml.types[lead.type]}</Badge>
                    <Badge variant={STATUS_VARIANT[lead.status]}>{ml.statuses[lead.status]}</Badge>
                    <span className="num text-xs text-subtle">
                      {formatDateTime(lead.createdAt)} · {lead.lang.toUpperCase()}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                    {leadDetailEntries(lead.details).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-subtle">{ml.details[k]}</dt>
                        <dd className="text-ink break-words">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {lead.note && <p className="mt-2 text-xs text-muted">{lead.note}</p>}
                </div>
                <ContactBlock label={ml.types[lead.type]} name={lead.name} phone={lead.phone} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {lead.status === 'new' && (
                  <Button size="sm" onClick={() => openEdit(lead, 'contacted')}>
                    {ml.markContacted}
                  </Button>
                )}
                {!isLeadFinal(lead.status) && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(lead, 'accepted')}>
                      {ml.accept}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(lead, 'rejected')}>
                      {ml.reject}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
          <div className="mt-2 flex items-center justify-between text-xs text-subtle">
            <span className="num">{ml.total(total)}</span>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  {ml.prev}
                </Button>
                <span className="num">
                  {page} / {pages}
                </span>
                <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                  {ml.next}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={ml.editTitle}
        subtitle={editing ? `${editing.lead.name} → ${ml.statuses[editing.status]}` : undefined}
        size="md"
      >
        <Textarea
          label={ml.note}
          placeholder={ml.notePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
        />
        <div className="mt-4 pt-4 border-t border-line flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(null)}>
            {m.common.cancel}
          </Button>
          <Button isLoading={saving} onClick={() => void save()}>
            {m.common.save}
          </Button>
        </div>
      </Modal>
    </PageBody>
  );
}
