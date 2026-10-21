'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { usePagination } from '@/hooks/usePagination';
import { auditLogApi, type AuditLogEntry } from '@/lib/compliance-api';
import { isUuid } from '@/lib/compliance';
import { auditActionLabels, auditTargetLabels, labelOf } from '@/lib/compliance-labels';
import { auditActorView } from '@/lib/audit-actor';
import { formatDateTime, formatPhone, shortId } from '@/lib/format';
import { t } from '@/locales';

const actionOptions = () => [
  { value: '', label: t().audit.allActions },
  ...Object.entries(auditActionLabels()).map(([value, label]) => ({ value, label })),
];
const targetOptions = () => [
  { value: '', label: t().audit.allTargets },
  ...Object.entries(auditTargetLabels()).map(([value, label]) => ({ value, label })),
];

function TargetCell({ e }: { e: AuditLogEntry }) {
  const label = labelOf(auditTargetLabels(), e.targetType);
  if (e.targetType === 'driver' && e.targetId) {
    return (
      <span>
        {label}{' '}
        <Link href={`/dashboard/drivers/${e.targetId}`} className="font-mono text-xs text-primary-text hover:underline">
          {shortId(e.targetId)}
        </Link>
      </span>
    );
  }
  return (
    <span>
      {label} <span className="font-mono text-xs text-muted">{shortId(e.targetId)}</span>
    </span>
  );
}

/** Kim bajardi (§22 `actor`): ism + rol, telefon ostida; tizim amali alohida. */
function ActorCell({ e }: { e: AuditLogEntry }) {
  const view = auditActorView(e.actor, e.actorUserId, formatPhone);
  if (view.isSystem) return <Badge variant="neutral">{t().audit.actor.system}</Badge>;
  return (
    <div className="min-w-0 leading-tight">
      <p className="truncate text-ink">
        {view.name}
        {view.role && <span className="text-muted"> · {view.role}</span>}
      </p>
      {e.actor?.name && e.actor.phone && (
        <p className="num whitespace-nowrap text-xs text-muted">{formatPhone(e.actor.phone)}</p>
      )}
    </div>
  );
}

function auditColumns(): DataTableColumn<AuditLogEntry>[] {
  const m = t().audit;
  return [
    {
      key: 'createdAt',
      header: m.colDate,
      cell: (e) => <span className="num whitespace-nowrap text-muted">{formatDateTime(e.createdAt, { withYear: true })}</span>,
    },
    {
      key: 'action',
      header: m.colAction,
      cell: (e) => <Badge variant="neutral">{labelOf(auditActionLabels(), e.action)}</Badge>,
    },
    { key: 'target', header: m.colTarget, cell: (e) => <TargetCell e={e} /> },
    {
      key: 'amount',
      header: m.colAmount,
      numeric: true,
      cell: (e) =>
        e.amount != null && Number(e.amount) !== 0 ? (
          <MoneyText value={e.amount} signed={e.action === 'wallet.manual_adjustment'} />
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: 'note',
      header: m.colNote,
      className: 'max-w-[320px]',
      cell: (e) => (
        <p className="truncate text-ink" title={e.note ?? undefined}>
          {e.note || '—'}
        </p>
      ),
    },
    {
      key: 'actor',
      header: m.colActor,
      hideBelow: 'xl',
      cell: (e) => <ActorCell e={e} />,
    },
  ];
}

/** Pul bilan bog'liq qo'lda amallar jurnali (`audit_logs`) — LEGAL-COMPLIANCE §12. */
export default function AuditLogPage() {
  const m = t().audit;
  const columns = auditColumns();
  const pagination = usePagination(20);
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');

  const targetIdValid = targetId.trim() === '' || isUuid(targetId);

  const load = useCallback(async () => {
    if (!targetIdValid) return;
    setIsLoading(true);
    try {
      const res = await auditLogApi.list({
        page: pagination.page,
        limit: pagination.limit,
        action: action || undefined,
        targetType: targetType || undefined,
        targetId: targetId.trim() || undefined,
      });
      const data = res.data.data;
      setRows(data.items);
      pagination.setTotal(data.total, Math.max(1, Math.ceil(data.total / pagination.limit)));
      setError(null);
    } catch {
      setError(m.loadFailed);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, action, targetType, targetId, targetIdValid]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    pagination.reset();
  };

  const isFiltered = !!action || !!targetType || targetId.trim() !== '';

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={m.title}
        description={m.description}
      />
      <DataTable
        ariaLabel={m.title}
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        loading={isLoading}
        error={error}
        onRetry={load}
        isFiltered={isFiltered}
        onClearFilters={() => {
          setAction('');
          setTargetType('');
          setTargetId('');
          pagination.reset();
        }}
        empty={{
          variant: 'first-use',
          icon: <History aria-hidden />,
          title: m.emptyTitle,
          description: m.emptyDesc,
        }}
        toolbar={
          <div className="flex flex-wrap items-start gap-2">
            <Select
              aria-label={m.actionType}
              options={actionOptions()}
              value={action}
              onChange={(e) => change(setAction)(e.target.value)}
              wrapperClassName="w-56"
            />
            <Select
              aria-label={m.targetType}
              options={targetOptions()}
              value={targetType}
              onChange={(e) => change(setTargetType)(e.target.value)}
              wrapperClassName="w-44"
            />
            <Input
              aria-label={m.targetId}
              placeholder={m.targetIdPlaceholder}
              mono
              value={targetId}
              error={targetIdValid ? undefined : m.targetIdError}
              onChange={(e) => change(setTargetId)(e.target.value)}
              wrapperClassName="w-72"
            />
          </div>
        }
        maxHeightClassName="max-h-[calc(100vh-260px)]"
        pagination={{
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          totalPages: pagination.totalPages,
          pageRange: pagination.pageRange,
          canGoPrev: pagination.canGoPrev,
          canGoNext: pagination.canGoNext,
          onPageChange: pagination.goToPage,
          onLimitChange: pagination.setLimit,
        }}
      />
    </div>
  );
}
