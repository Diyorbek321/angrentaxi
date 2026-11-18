'use client';

import type { Order } from '@/lib/api';
import { taxiOutcome } from '@/lib/taxi-penalties';
import { DetailCard, KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { MoneyText } from '@/components/ui/MoneyText';
import { t } from '@/locales';

/** Kech bekor qilish / kelmaslik jarimasi yoki uzilgan safar (INCIDENT-POLICY §5). */
export function TaxiOutcomeCard({ order }: { order: Order }) {
  const outcome = taxiOutcome(order);
  if (!outcome) return null;
  const m = t().safety.penalties;
  return (
    <DetailCard title={m.outcomeTitle}>
      <KeyValueList>
        {outcome.kind === 'interrupted' ? (
          <>
            <KeyValue label={m.outcomeTitle}>{m.interrupted}</KeyValue>
            <KeyValue label={m.reasonLabel}>{outcome.reason ? m.reasons[outcome.reason] : '—'}</KeyValue>
          </>
        ) : (
          <>
            <KeyValue label={m.outcomeTitle}>{outcome.kind === 'no_show' ? m.noShow : m.lateCancel}</KeyValue>
            {outcome.fee > 0 && (
              <KeyValue label={m.feeLabel}>
                <span className="inline-flex flex-col">
                  <MoneyText value={outcome.fee} />
                  <span className="text-[11px] text-subtle">{m.feeNote}</span>
                </span>
              </KeyValue>
            )}
          </>
        )}
      </KeyValueList>
    </DetailCard>
  );
}
