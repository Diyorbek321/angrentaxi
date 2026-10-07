'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Banknote, Phone } from 'lucide-react';
import { CashDispute, getCashDisputes } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
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
 */
export function CashDisputesSection() {
  const [disputes, setDisputes] = useState<CashDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
