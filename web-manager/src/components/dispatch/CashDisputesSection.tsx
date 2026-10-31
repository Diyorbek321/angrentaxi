'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Phone } from 'lucide-react';
import { CashDispute, getCashDisputes, resolveCashDispute } from '@/lib/api';
import { RESOLUTION_MAX, validateResolution } from '@/lib/cash-dispute';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { MoneyText } from '@/components/ui/MoneyText';
import { formatDateTime, formatMoney, formatPhone, shortId } from '@/lib/format';
import { t } from '@/locales';

const POLL_MS = 30_000;

/**
 * Naqd nizolar: kuryer "do'konga to'ladim" dedi, sotuvchi "olmadim" dedi.
 *
 * Kuryer tovarni do'kondan o'z pulidan sotib oladi (backend
 * `delivery/vendor-cash.ts`) — nizoda kimdir pulsiz qolgan. Dispetcher ikki
 * tomonga qo'ng'iroq qilib aniqlaydi; kuryer safari buyurtmalar ro'yxatida.
 * Aniqlangach "Hal qilindi" — izoh bilan; nizo navbatdan chiqadi, sotuvchi
 * esa izohni o'z panelida ko'radi.
 */
export function CashDisputesSection() {
  const [disputes, setDisputes] = useState<CashDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<CashDispute | null>(null);
  const m = t().dispatch.cashDisputes;

  const load = useCallback(async () => {
    try {
      setDisputes(await getCashDisputes());
      setError(null);
    } catch {
      setError(t().dispatch.cashDisputes.loadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-h3 text-ink">{m.title}</h2>
        {disputes.length > 0 && (
          <Badge variant="danger" size="sm">
            {disputes.length}
          </Badge>
        )}
      </div>
      {error && disputes.length > 0 && (
        <RetryBanner message={error} onRetry={load} keepsLastData className="mb-3" />
      )}
      {error && disputes.length === 0 ? (
        <Card padding="none">
          <ErrorState compact title={error} onRetry={load} />
        </Card>
      ) : loading ? (
        <SkeletonCards count={2} height="h-[76px]" />
      ) : disputes.length === 0 ? (
        <Card>
          <EmptyState
            compact
            variant="cleared"
            icon={<Banknote aria-hidden />}
            title={m.emptyTitle}
            description={m.emptyDesc}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {disputes.map((d) => (
            <Card key={d.vendorOrderId} className="border-danger/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {d.vendorName} — <MoneyText value={d.amount} /> {m.notReceived}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {d.kind === 'food' ? t().lib.serviceType.food : t().lib.serviceType.market} · <span className="font-mono">{shortId(d.vendorOrderId)}</span> · {m.disputed}{' '}
                    {formatDateTime(d.disputedAt)}
                    {d.courierPaidAt && ` · ${m.courierPaid(formatDateTime(d.courierPaidAt))}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {d.vendorPhone && (
                    <a
                      href={`tel:${d.vendorPhone}`}
                      className="num inline-flex items-center gap-1 text-primary-text hover:underline"
                    >
                      <Phone size={11} aria-hidden />
                      {formatPhone(d.vendorPhone)}
                    </a>
                  )}
                  {d.deliveryOrderId && (
                    <Link href={`/orders/${d.deliveryOrderId}`} className="text-primary-text hover:underline">
                      {m.courierTrip}
                    </Link>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<CheckCircle2 size={13} aria-hidden />}
                    onClick={() => setResolving(d)}
                  >
                    {m.resolve}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ResolveDisputeModal
        dispute={resolving}
        onClose={() => setResolving(null)}
        onResolved={(d) => {
          setResolving(null);
          // Optimistik: navbatdan darhol chiqadi, keyingi so'rov tasdiqlaydi.
          setDisputes((prev) => prev.filter((x) => x.vendorOrderId !== d.vendorOrderId));
          void load();
        }}
      />
    </section>
  );
}

function ResolveDisputeModal({
  dispute,
  onClose,
  onResolved,
}: {
  dispute: CashDispute | null;
  onClose: () => void;
  onResolved: (d: CashDispute) => void;
}) {
  const { toast } = useToast();
  const m = t().dispatch.cashDisputes;
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Har yangi nizo uchun bo'sh forma.
  useEffect(() => {
    setNote('');
    setTouched(false);
  }, [dispute?.vendorOrderId]);

  if (!dispute) return null;
  const validation = validateResolution(note);

  const submit = async () => {
    setTouched(true);
    if (validation) return;
    setSaving(true);
    try {
      await resolveCashDispute(dispute.kind, dispute.vendorOrderId, note);
      toast({ title: m.closedToast(dispute.vendorName), variant: 'success' });
      onResolved(dispute);
    } catch (err) {
      console.error('Resolve cash dispute failed:', err);
      toast({
        title: m.closeFailed,
        description: m.closeFailedDesc,
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={m.modalTitle}
      subtitle={`${dispute.vendorName} — ${formatMoney(dispute.amount)}`}
      size="md"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Textarea
          label={m.noteLabel}
          placeholder={m.notePlaceholder}
          value={note}
          maxLength={RESOLUTION_MAX}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => setTouched(true)}
          error={touched ? validation ?? undefined : undefined}
          hint={m.noteHint}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t().common.cancel}
          </Button>
          <Button type="submit" isLoading={saving}>
            {t().common.close}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
