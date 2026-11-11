'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, CreditCard, Phone } from 'lucide-react';
import { getPendingRefunds, markRefundDone, PendingRefund } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error';
import { INCIDENT_NOTE_MAX } from '@/lib/delivery-incident';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { MoneyText } from '@/components/ui/MoneyText';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatMoney, formatPhone, shortId } from '@/lib/format';
import { t } from '@/locales';

const POLL_MS = 60_000;

/**
 * Qaytarilishi kerak (karta): kartali buyurtma qaytarildi, mijoz to'lagan
 * summadan qaytarish haqi ushlanib qolgani mijozga qo'lda qaytariladi
 * (Payme/Click kabinetidan). Qaytarilgach "Qaytarildi" — navbatdan chiqadi.
 */
export function PendingRefundsSection() {
  const [items, setItems] = useState<PendingRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<PendingRefund | null>(null);
  const m = t().dispatch.pendingRefunds;

  const load = useCallback(async () => {
    try {
      setItems(await getPendingRefunds());
      setError(null);
    } catch (err) {
      console.error('Failed to load pending refunds:', err);
      setError(t().dispatch.pendingRefunds.loadFailed);
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
        {items.length > 0 && (
          <Badge variant="danger" size="sm">
            {items.length}
          </Badge>
        )}
      </div>
      {error && items.length > 0 && (
        <RetryBanner message={error} onRetry={load} keepsLastData className="mb-3" />
      )}
      {error && items.length === 0 ? (
        <Card padding="none">
          <ErrorState compact title={error} onRetry={load} />
        </Card>
      ) : loading ? (
        <SkeletonCards count={1} height="h-[76px]" />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            compact
            variant="cleared"
            icon={<CreditCard aria-hidden />}
            title={m.emptyTitle}
            description={m.emptyDesc}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((r) => (
            <Card key={`${r.kind}:${r.vendorOrderId}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {r.vendorName} — {m.refundDue} <MoneyText value={r.refundDue} />
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {r.kind === 'food' ? t().lib.serviceType.food : t().lib.serviceType.market} ·{' '}
                    <span className="font-mono">{shortId(r.vendorOrderId)}</span> · {m.paid}{' '}
                    {formatMoney(r.totalPrice)} · {m.charge} {formatMoney(r.returnCharge)}
                    {r.returnedAt && ` · ${m.returnedAt(formatDateTime(r.returnedAt))}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {r.deliveryOrderId && (
                    <Link href={`/orders/${r.deliveryOrderId}`} className="num text-primary-text hover:underline">
                      #{shortId(r.deliveryOrderId)}
                    </Link>
                  )}
                  {r.vendorPhone && (
                    <a
                      href={`tel:${r.vendorPhone}`}
                      className="num inline-flex items-center gap-1 text-primary-text hover:underline"
                    >
                      <Phone size={11} aria-hidden />
                      {formatPhone(r.vendorPhone)}
                    </a>
                  )}
                  {r.customerPhone && (
                    <a
                      href={`tel:${r.customerPhone}`}
                      className="num inline-flex items-center gap-1 text-primary-text hover:underline"
                    >
                      <Phone size={11} aria-hidden />
                      {formatPhone(r.customerPhone)}
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<CheckCircle2 size={13} aria-hidden />}
                    onClick={() => setMarking(r)}
                  >
                    {m.done}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <RefundDoneModal
        refund={marking}
        onClose={() => setMarking(null)}
        onDone={(r) => {
          setMarking(null);
          // Optimistik: navbatdan darhol chiqadi, keyingi so'rov tasdiqlaydi.
          setItems((prev) =>
            prev.filter((x) => !(x.kind === r.kind && x.vendorOrderId === r.vendorOrderId))
          );
          void load();
        }}
      />
    </section>
  );
}

function RefundDoneModal({
  refund,
  onClose,
  onDone,
}: {
  refund: PendingRefund | null;
  onClose: () => void;
  onDone: (r: PendingRefund) => void;
}) {
  const { toast } = useToast();
  const m = t().dispatch.pendingRefunds;
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote('');
  }, [refund?.vendorOrderId]);

  if (!refund) return null;

  const submit = async () => {
    setSaving(true);
    try {
      await markRefundDone(refund.kind, refund.vendorOrderId, note);
      toast({ title: m.doneToast(refund.vendorName), variant: 'success' });
      onDone(refund);
    } catch (err) {
      console.error('Mark refund done failed:', err);
      toast({ title: m.doneFailed, description: apiErrorMessage(err, m.doneFailedDesc), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={m.modalTitle}
      subtitle={`${refund.vendorName} — ${formatMoney(refund.refundDue)}`}
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
          maxLength={INCIDENT_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t().common.cancel}
          </Button>
          <Button type="submit" isLoading={saving}>
            {m.done}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
