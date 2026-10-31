'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { DetailCard } from '@/components/ui/KeyValue';
import { MoneyText } from '@/components/ui/MoneyText';
import { SkeletonText } from '@/components/ui/Skeleton';
import { useResource } from '@/hooks/useResource';
import { auditLogApi, type AuditLogEntry } from '@/lib/compliance-api';
import { auditActionLabels, labelOf } from '@/lib/compliance-labels';
import { auditActorView } from '@/lib/audit-actor';
import { mergeHistory } from '@/lib/audit-diff';
import { formatDateTime, formatPhone } from '@/lib/format';
import { t } from '@/locales';

const HISTORY_LIMIT = 10;

/**
 * Haydovchi "Tarix"i — shu haydovchi bo'yicha xodimlar amallari, yangisi
 * birinchi. Profil yozuvlari (`driver/<id>`: hamyon, KYC, soliq) va akkaunt
 * yozuvlari (`user/<userId>`: bloklash) birlashtiriladi. Nizolarning ko'pi
 * shu yerda hal bo'ladi — global jurnalni ochish shart emas.
 */
export function DriverHistoryCard({ driverId, userId }: { driverId: string; userId: string }) {
  const m = t().drivers.history;
  const { data, loading, error, reload } = useResource(
    async () => {
      const [profile, account] = await Promise.all([
        auditLogApi.list({ targetType: 'driver', targetId: driverId, page: 1, limit: HISTORY_LIMIT }),
        auditLogApi.list({ targetType: 'user', targetId: userId, page: 1, limit: HISTORY_LIMIT }),
      ]);
      return mergeHistory([profile.data.data.items, account.data.data.items], HISTORY_LIMIT);
    },
    m.loadFailed,
    [driverId, userId]
  );

  const fullLogHref = `/dashboard/audit-log?targetType=driver&targetId=${driverId}`;

  return (
    <DetailCard
      title={m.title}
      actions={
        <Link href={fullLogHref} className="text-xs text-primary-text hover:underline">
          {m.openLog}
        </Link>
      }
    >
      {loading && !data ? (
        <SkeletonText lines={4} />
      ) : error && !data ? (
        <ErrorState title={error} onRetry={reload} compact />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted">{m.empty}</p>
      ) : (
        <ol className="space-y-3">
          {data.map((e) => (
            <HistoryItem key={e.id} e={e} />
          ))}
        </ol>
      )}
    </DetailCard>
  );
}

function HistoryItem({ e }: { e: AuditLogEntry }) {
  const actor = auditActorView(e.actor, e.actorUserId, formatPhone);
  return (
    <li className="text-sm leading-snug">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-ink">{labelOf(auditActionLabels(), e.action)}</span>
        {e.amount != null && Number(e.amount) !== 0 && (
          <MoneyText value={e.amount} signed={e.action === 'wallet.manual_adjustment'} className="text-xs" />
        )}
      </div>
      <p className="text-xs text-muted">
        <span className="num">{formatDateTime(e.createdAt)}</span>
        {' · '}
        {actor.isSystem ? (
          <Badge variant="neutral">{t().audit.actor.system}</Badge>
        ) : (
          <>
            {actor.name}
            {actor.role && ` (${actor.role})`}
          </>
        )}
      </p>
      {e.note && <p className="mt-0.5 text-xs text-ink">{e.note}</p>}
    </li>
  );
}
