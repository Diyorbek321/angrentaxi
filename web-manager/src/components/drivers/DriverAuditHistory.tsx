'use client';

import { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { getAuditLog, type AuditLogEntry } from '@/lib/api';
import { apiErrorMessage } from '@/lib/driver-legal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { MoneyText } from '@/components/ui/MoneyText';
import { SkeletonText } from '@/components/ui/Skeleton';
import { formatDateTime, formatPhone } from '@/lib/format';
import { auditActorView } from '@/lib/audit-actor';

const PAGE_SIZE = 5;

const ACTION_LABEL: Record<string, string> = {
  'wallet.manual_adjustment': 'Qoʻlda tuzatish',
  'shift_pass.cancel': 'Smena bekor qilindi',
  'payment.refund_clawback': 'Karta qaytarimi — ulush qaytarib olindi',
};

function AuditActor({ entry }: { entry: AuditLogEntry }) {
  const view = auditActorView(entry.actor, entry.actorUserId, formatPhone);
  return (
    <span title={entry.actor?.phone ? formatPhone(entry.actor.phone) : undefined}>
      <span className="text-muted">{view.name}</span>
      {view.role && <> ({view.role})</>}
    </span>
  );
}

export interface DriverAuditHistoryProps {
  driverId: string;
  /** Bump after a new adjustment so the list re-reads from page 1. */
  refreshKey?: number;
}

/**
 * Bitta haydovchi bo'yicha qo'lda pul amallari jurnali
 * (`GET /admin/audit-log?targetType=driver&targetId=`, drivers_finance).
 * Kim, qachon, qancha va nega — izoh majburiy bo'lgani uchun har yozuvda bor.
 */
export function DriverAuditHistory({ driverId, refreshKey = 0 }: DriverAuditHistoryProps) {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      try {
        const result = await getAuditLog({
          targetType: 'driver',
          targetId: driverId,
          page: nextPage,
          limit: PAGE_SIZE,
        });
        setItems((prev) => (nextPage === 1 ? result.items : [...prev, ...result.items]));
        setTotal(result.total);
        setPage(nextPage);
        setError(null);
        setLoadedOnce(true);
      } catch (err) {
        setError(apiErrorMessage(err, 'Amallar tarixini yuklab boʻlmadi'));
      } finally {
        setLoading(false);
      }
    },
    [driverId]
  );

  useEffect(() => {
    setItems([]);
    setLoadedOnce(false);
    void load(1);
  }, [load, refreshKey]);

  return (
    <section aria-label="Amallar tarixi" className="space-y-2">
      <p className="text-sm font-medium text-ink">Amallar tarixi</p>
      {error && !loadedOnce ? (
        <ErrorState compact title="Tarixni yuklab boʻlmadi" message={error} onRetry={() => load(1)} retrying={loading} />
      ) : !loadedOnce ? (
        <SkeletonText lines={3} />
      ) : items.length === 0 ? (
        <EmptyState
          variant="first-use"
          icon={<History aria-hidden />}
          title="Qoʻlda amal boʻlmagan"
          description="Balans tuzatishlari izohi bilan shu yerda koʻrinadi."
        />
      ) : (
        <>
          <ul className="divide-y divide-line rounded-ds-sm border border-line">
            {items.map((entry) => (
              <li key={entry.id} className="px-3 py-2 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink font-medium">{ACTION_LABEL[entry.action] ?? entry.action}</span>
                  {entry.amount != null && (
                    <MoneyText
                      value={entry.amount}
                      signed
                      className={entry.amount < 0 ? 'text-danger-deep dark:text-danger-light' : 'text-ink'}
                    />
                  )}
                </div>
                {entry.note && <p className="mt-0.5 text-muted break-words">{entry.note}</p>}
                <p className="mt-0.5 text-[11px] text-subtle">
                  <span className="num">{formatDateTime(entry.createdAt, { withYear: true })}</span>
                  {' · '}
                  <AuditActor entry={entry} />
                </p>
              </li>
            ))}
          </ul>
          {error && <p className="text-xs text-danger-deep dark:text-danger-light">{error}</p>}
          {items.length < total && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => load(page + 1)} isLoading={loading}>
              Yana koʻrsatish ({total - items.length})
            </Button>
          )}
        </>
      )}
    </section>
  );
}
