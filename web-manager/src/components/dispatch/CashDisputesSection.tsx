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
import { formatDateTime, formatMoney, formatPhone } from '@/lib/format';

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

  const load = useCallback(async () => {
    try {
      setDisputes(await getCashDisputes());
      setError(null);
    } catch {
      setError('Naqd nizolarni yuklab boʻlmadi');
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
        <h2 className="text-sm font-semibold text-ink">Naqd nizolar</h2>
        {disputes.length > 0 && (
          <Badge variant="danger" size="sm">
            {disputes.length}
          </Badge>
        )}
      </div>
      {error ? (
        <ErrorState compact message={error} onRetry={() => void load()} />
      ) : loading ? null : disputes.length === 0 ? (
        <Card>
          <EmptyState
            compact
            tone="positive"
            icon={<Banknote size={20} />}
            title="Nizo yoʻq"
            description="Sotuvchilar kuryerlardan tovar pulini olgan."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {disputes.map((d) => (
            <Card key={d.vendorOrderId} className="ring-1 ring-danger/30">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {d.vendorName} — {formatMoney(d.amount)} olinmagan
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {d.kind === 'food' ? 'Ovqat' : 'Market'} · #{d.vendorOrderId.slice(0, 8)} · nizo{' '}
                    {formatDateTime(d.disputedAt)}
                    {d.courierPaidAt && ` · kuryer „toʻladim“ dedi ${formatDateTime(d.courierPaidAt)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {d.vendorPhone && (
                    <a
                      href={`tel:${d.vendorPhone}`}
                      className="inline-flex items-center gap-1 font-mono text-primary-text hover:underline"
                    >
                      <Phone size={11} aria-hidden />
                      {formatPhone(d.vendorPhone)}
                    </a>
                  )}
                  {d.deliveryOrderId && (
                    <Link href={`/orders/${d.deliveryOrderId}`} className="text-primary-text hover:underline">
                      Kuryer safari →
                    </Link>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<CheckCircle2 size={13} aria-hidden />}
                    onClick={() => setResolving(d)}
                  >
                    Hal qilindi
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
      toast({ title: `${dispute.vendorName}: nizo yopildi`, variant: 'success' });
      onResolved(dispute);
    } catch (err) {
      console.error('Resolve cash dispute failed:', err);
      toast({
        title: 'Nizoni yopib boʻlmadi',
        description: 'Boshqa dispetcher yopgan boʻlishi mumkin — roʻyxatni yangilang.',
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
      title="Nizo hal qilindi"
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
          label="Qanday hal qilindi"
          placeholder="Masalan: kuryer pulni doʻkonga olib bordi, sotuvchi tasdiqladi"
          value={note}
          maxLength={RESOLUTION_MAX}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => setTouched(true)}
          error={touched ? validation ?? undefined : undefined}
          hint="Izoh sotuvchiga ham koʻrinadi."
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Bekor qilish
          </Button>
          <Button type="submit" isLoading={saving}>
            Yopish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
