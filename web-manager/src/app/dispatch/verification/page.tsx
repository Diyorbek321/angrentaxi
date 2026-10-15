'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Phone, RefreshCw, X } from 'lucide-react';
import {
  getPendingVerifications,
  getVerificationFile,
  PendingVerification,
  reviewVerification,
  VerificationKind,
} from '@/lib/api';
import {
  groupVerifications,
  isLegalDocument,
  KIND_LABEL,
  validateValidUntil,
  verificationLabel,
  VerificationGroup,
} from '@/lib/verification';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { Skeleton, SkeletonCards } from '@/components/ui/Skeleton';
import { PageBody } from '@/components/ui/PageBody';
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
  // Hujjat tasdiqlanganda kiritiladigan «amal qilish muddati» (id → YYYY-MM-DD).
  const [validUntil, setValidUntil] = useState<Record<string, string>>({});
  const [validUntilErrors, setValidUntilErrors] = useState<Record<string, string>>({});

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
        const until = approved && item.kind === 'document' ? validUntil[item.id]?.trim() : undefined;
        await reviewVerification(item.id, {
          approved,
          rejectionReason,
          ...(until ? { validUntil: until } : {}),
        });
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

  /** Hujjat sanalarini tekshiradi, keyin tasdiqlaydi. */
  const approve = (items: PendingVerification[]) => {
    const today = new Date().toISOString().slice(0, 10);
    const found: Record<string, string> = {};
    for (const item of items) {
      if (item.kind !== 'document') continue;
      const err = validateValidUntil(validUntil[item.id] ?? '', today);
      if (err) found[item.id] = err;
    }
    setValidUntilErrors((prev) => {
      const next = { ...prev };
      for (const item of items) delete next[item.id];
      return { ...next, ...found };
    });
    if (Object.keys(found).length > 0) return;
    void decide(items, true);
  };

  const confirmReject = async () => {
    if (!rejecting || !reason.trim()) return;
    const item = rejecting;
    setRejecting(null);
    await decide([item], false, reason.trim());
    setReason('');
  };

  return (
    <PageBody className="max-w-6xl">
        <PageHeader
          title="Koʻrik va selfi"
          description="Mashina koʻrigi 30 kunda, selfi 3 kunda, hujjat — oʻzidagi muddatgacha. Muddat oʻtsa 1 kundan keyin haydovchi onlayn chiqa olmaydi."
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void load()}
              isLoading={isLoading && hasLoadedOnce}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              Yangilash
            </Button>
          }
        />

        <div className="mb-3">
          <SegmentedControl
            items={TABS.map((t) => ({ ...t, count: counts[t.value] || undefined }))}
            value={tab}
            onChange={setTab}
            ariaLabel="Tekshiruv turi"
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
          <SkeletonCards count={3} height="h-64" />
        ) : visible.length === 0 ? (
          <Card padding="none">
            <EmptyState
              variant="cleared"
              icon={<CheckCircle2 aria-hidden />}
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
                onApproveAll={() => approve(group.items)}
                onApprove={(item) => approve([item])}
                validUntil={validUntil}
                validUntilErrors={validUntilErrors}
                onValidUntilChange={(id, value) => {
                  setValidUntil((prev) => ({ ...prev, [id]: value }));
                  setValidUntilErrors((prev) => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                  });
                }}
                onReject={(item) => {
                  setReason('');
                  setRejecting(item);
                }}
              />
            ))}
          </div>
        )}

      <Modal
        isOpen={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Rad etish"
        subtitle={rejecting ? `${verificationLabel(rejecting)} — ${rejecting.driverName ?? 'Haydovchi'}` : undefined}
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
        <div className="mt-4 pt-4 border-t border-line flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRejecting(null)}>
            Bekor qilish
          </Button>
          <Button variant="danger" disabled={!reason.trim()} onClick={() => void confirmReject()}>
            Rad etish
          </Button>
        </div>
      </Modal>
    </PageBody>
  );
}

function GroupCard({
  group,
  busyIds,
  onApproveAll,
  onApprove,
  onReject,
  validUntil,
  validUntilErrors,
  onValidUntilChange,
}: {
  group: VerificationGroup;
  busyIds: Set<string>;
  onApproveAll: () => void;
  onApprove: (item: PendingVerification) => void;
  onReject: (item: PendingVerification) => void;
  validUntil: Record<string, string>;
  validUntilErrors: Record<string, string>;
  onValidUntilChange: (id: string, value: string) => void;
}) {
  const anyBusy = group.items.some((i) => busyIds.has(i.id));
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{KIND_LABEL[group.kind]}</Badge>
            <span className="num text-xs text-subtle">{formatDateTime(group.submittedAt)}</span>
          </div>
          <p className="mt-1.5 text-[13px] font-semibold text-ink">{group.driverName ?? 'Haydovchi'}</p>
          {group.driverPhone && (
            <a
              href={`tel:${group.driverPhone}`}
              className="num inline-flex items-center gap-1 text-xs text-primary-text hover:underline"
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
          <div key={item.id} className="rounded-ds-sm border border-line p-2">
            {item.kind === 'selfie' ? (
              <div className="grid grid-cols-2 gap-2">
                <Photo id={item.referenceSubmissionId} caption="Avvalgi" />
                <Photo id={item.id} caption="Yangi" />
              </div>
            ) : (
              <Photo id={item.id} caption={verificationLabel(item)} />
            )}
            {item.kind === 'document' && (
              <Input
                type="date"
                size="sm"
                wrapperClassName="mt-2"
                label="Amal qilish muddati"
                aria-label={`${verificationLabel(item)} — amal qilish muddati`}
                value={validUntil[item.id] ?? ''}
                onChange={(e) => onValidUntilChange(item.id, e.target.value)}
                error={validUntilErrors[item.id]}
                hint={
                  isLegalDocument(item.code)
                    ? 'Hujjatdagi sana. Kiritilmasa — 365 kun'
                    : 'Hujjatdagi sana (ixtiyoriy)'
                }
                disabled={busyIds.has(item.id)}
              />
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
                aria-label={`${verificationLabel(item)} — rad etish`}
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
  // Hujjatlar (litsenziya, tibbiy ma'lumotnoma) PDF bo'lib kelishi mumkin —
  // `<img>` ularni ko'rsata olmaydi, havola beramiz.
  const [isPdf, setIsPdf] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    getVerificationFile(id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setIsPdf(blob.type === 'application/pdf');
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
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-ds-xs bg-surface-2">
        {!id || failed ? (
          <span className="px-2 text-center text-[11px] text-subtle">{failed ? 'Ochilmadi' : 'Yoʻq'}</span>
        ) : url && isPdf ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="px-2 text-center text-xs font-medium text-primary-text hover:underline"
          >
            PDF faylni ochish
          </a>
        ) : url ? (
          <a href={url} target="_blank" rel="noreferrer" className="h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image cannot optimise it */}
            <img src={url} alt={caption} className="h-full w-full object-cover" />
          </a>
        ) : (
          <Skeleton className="h-full w-full rounded-none" />
        )}
      </div>
      <figcaption className="mt-1 truncate text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}
