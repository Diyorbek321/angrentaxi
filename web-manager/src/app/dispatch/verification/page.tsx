'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Phone, RefreshCw, ShieldCheck, X } from 'lucide-react';
import {
  getPendingVerifications,
  getVerificationFile,
  PendingVerification,
  reviewVerification,
  VerificationKind,
} from '@/lib/api';
import { groupVerifications, KIND_LABEL, VerificationGroup } from '@/lib/verification';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatPhone } from '@/lib/format';

const TABS: { value: VerificationKind; label: string }[] = [
  { value: 'vehicle_photo', label: 'Mashina koʻrigi' },
  { value: 'selfie', label: 'Selfi' },
  { value: 'document', label: 'Hujjatlar' },
];

/**
 * Haydovchilarning davriy tekshiruvi: mashina koʻrigi (30 kunda), selfi
 * (3 kunda) va hujjatlar.
 *
 * Muddat oʻtgach 1 kun muhlatdan keyin haydovchi onlayn chiqa olmaydi, lekin
 * "tekshirilmoqda" holati BLOKLAMAYDI — yaʼni bu navbat sekin ishlansa
 * haydovchi jabr koʻrmaydi, faqat nazorat kechikadi.
 */
export default function VerificationPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<VerificationKind>('vehicle_photo');
  const [entries, setEntries] = useState<PendingVerification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<PendingVerification | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setEntries(await getPendingVerifications());
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      setError('Tekshiruv navbatini yuklab boʻlmadi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupVerifications(entries), [entries]);
  const visible = groups.filter((g) => g.kind === tab);
  const counts = useMemo(() => {
    const result: Record<VerificationKind, number> = { vehicle_photo: 0, selfie: 0, document: 0 };
    for (const g of groups) result[g.kind] += 1;
    return result;
  }, [groups]);

  const decide = async (items: PendingVerification[], approved: boolean, rejectionReason?: string) => {
    const ids = items.map((i) => i.id);
    setBusyIds((prev) => new Set(Array.from(prev).concat(ids)));
    try {
      for (const item of items) {
        await reviewVerification(item.id, { approved, rejectionReason });
      }
      setEntries((prev) => prev.filter((e) => !ids.includes(e.id)));
      toast({ title: approved ? 'Tasdiqlandi' : 'Rad etildi', variant: 'success' });
    } catch {
      toast({ title: 'Saqlab boʻlmadi', description: 'Navbat yangilanadi', variant: 'error' });
      await load();
    } finally {
      setBusyIds((prev) => new Set(Array.from(prev).filter((id) => !ids.includes(id))));
    }
  };

  const confirmReject = async () => {
    if (!rejecting || !reason.trim()) return;
    const item = rejecting;
    setRejecting(null);
    await decide([item], false, reason.trim());
    setReason('');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-6xl mx-auto">
        <PageHeader
          title="Koʻrik va selfi"
          description="Mashina koʻrigi 30 kunda, selfi 3 kunda. Muddat oʻtsa 1 kundan keyin haydovchi onlayn chiqa olmaydi."
          icon={<ShieldCheck size={17} />}
          actions={
            <Button variant="secondary" size="sm" onClick={() => void load()} leftIcon={<RefreshCw size={13} />}>
              Yangilash
            </Button>
          }
        />

        <div className="mb-3">
          <Tabs
            items={TABS.map((t) => ({ ...t, label: counts[t.value] ? `${t.label} (${counts[t.value]})` : t.label }))}
            value={tab}
            onChange={setTab}
            size="sm"
          />
        </div>

        {error && hasLoadedOnce && (
          <RetryBanner message={error} onRetry={() => void load()} keepsLastData className="mb-3" />
        )}

        {error && !hasLoadedOnce ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : isLoading && !hasLoadedOnce ? (
          <SkeletonTable rows={3} cols={4} />
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCircle2 size={22} />}
              title="Navbat boʻsh"
              description={`${KIND_LABEL[tab]} boʻyicha tekshiriladigan narsa qolmadi.`}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((group) => (
              <GroupCard
                key={group.key}
                group={group}
                busyIds={busyIds}
                onApproveAll={() => void decide(group.items, true)}
                onApprove={(item) => void decide([item], true)}
                onReject={(item) => {
                  setReason('');
                  setRejecting(item);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Rad etish"
        subtitle={rejecting ? `${rejecting.label} — ${rejecting.driverName ?? 'Haydovchi'}` : undefined}
        size="md"
      >
        <Textarea
          label="Sabab (haydovchiga koʻrinadi)"
          placeholder="Masalan: bagaj yopiq, ichi koʻrinmayapti"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={300}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRejecting(null)}>
            Bekor qilish
          </Button>
          <Button variant="danger" disabled={!reason.trim()} onClick={() => void confirmReject()}>
            Rad etish
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function GroupCard({
  group,
  busyIds,
  onApproveAll,
  onApprove,
  onReject,
}: {
  group: VerificationGroup;
  busyIds: Set<string>;
  onApproveAll: () => void;
  onApprove: (item: PendingVerification) => void;
  onReject: (item: PendingVerification) => void;
}) {
  const anyBusy = group.items.some((i) => busyIds.has(i.id));
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{KIND_LABEL[group.kind]}</Badge>
            <span className="text-xs text-subtle">{formatDateTime(group.submittedAt)}</span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-ink">{group.driverName ?? 'Haydovchi'}</p>
          {group.driverPhone && (
            <a
              href={`tel:${group.driverPhone}`}
              className="inline-flex items-center gap-1 font-mono text-xs text-primary-text hover:underline"
            >
              <Phone size={11} aria-hidden />
              {formatPhone(group.driverPhone)}
            </a>
          )}
        </div>
        {group.items.length > 1 && (
          <Button size="sm" isLoading={anyBusy} onClick={onApproveAll}>
            Hammasini tasdiqlash ({group.items.length})
          </Button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {group.items.map((item) => (
          <div key={item.id} className="rounded-lg border border-divider p-2">
            {item.kind === 'selfie' ? (
              <div className="grid grid-cols-2 gap-2">
                <Photo id={item.referenceSubmissionId} caption="Avvalgi" />
                <Photo id={item.id} caption="Yangi" />
              </div>
            ) : (
              <Photo id={item.id} caption={item.label} />
            )}
            {item.kind === 'selfie' && !item.referenceSubmissionId && (
              <p className="mt-1 text-[11px] text-muted">Solishtirish uchun avvalgi selfi yoki pasport yoʻq</p>
            )}
            <div className="mt-2 flex gap-1.5">
              <Button size="sm" className="flex-1" disabled={busyIds.has(item.id)} onClick={() => onApprove(item)}>
                Tasdiqlash
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label={`${item.label} — rad etish`}
                disabled={busyIds.has(item.id)}
                onClick={() => onReject(item)}
              >
                <X size={14} aria-hidden />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * Fayl blob sifatida olinadi: proksi sessiya cookie'si bilan soʻraydi, oddiy
 * `<img src>` esa backendga token bilan bora olmaydi.
 */
function Photo({ id, caption }: { id: string | null; caption: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    getVerificationFile(id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return (
    <figure>
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md bg-surface-2">
        {!id || failed ? (
          <span className="px-2 text-center text-[11px] text-subtle">{failed ? 'Ochilmadi' : 'Yoʻq'}</span>
        ) : url ? (
          <a href={url} target="_blank" rel="noreferrer" className="h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image cannot optimise it */}
            <img src={url} alt={caption} className="h-full w-full object-cover" />
          </a>
        ) : (
          <span className="h-full w-full animate-pulse bg-surface-2" />
        )}
      </div>
      <figcaption className="mt-1 truncate text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}
