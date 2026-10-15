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
import { AUDIT_ACTION_LABELS, AUDIT_TARGET_LABELS, labelOf } from '@/lib/compliance-labels';
import { auditActorView } from '@/lib/audit-actor';
import { formatDateTime, formatPhone, shortId } from '@/lib/format';

const ACTION_OPTIONS = [
  { value: '', label: 'Barcha amallar' },
  ...Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label })),
];
const TARGET_OPTIONS = [
  { value: '', label: 'Barcha obyektlar' },
  ...Object.entries(AUDIT_TARGET_LABELS).map(([value, label]) => ({ value, label })),
];

function TargetCell({ e }: { e: AuditLogEntry }) {
  const label = labelOf(AUDIT_TARGET_LABELS, e.targetType);
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
  if (view.isSystem) return <Badge variant="neutral">Tizim</Badge>;
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

const columns: DataTableColumn<AuditLogEntry>[] = [
  {
    key: 'createdAt',
    header: 'Sana',
    cell: (e) => <span className="num whitespace-nowrap text-muted">{formatDateTime(e.createdAt, { withYear: true })}</span>,
  },
  {
    key: 'action',
    header: 'Amal',
    cell: (e) => <Badge variant="neutral">{labelOf(AUDIT_ACTION_LABELS, e.action)}</Badge>,
  },
  { key: 'target', header: 'Obyekt', cell: (e) => <TargetCell e={e} /> },
  {
    key: 'amount',
    header: 'Summa',
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
    header: 'Izoh',
    className: 'max-w-[320px]',
    cell: (e) => (
      <p className="truncate text-ink" title={e.note ?? undefined}>
        {e.note || '—'}
      </p>
    ),
  },
  {
    key: 'actor',
    header: 'Bajaruvchi',
    hideBelow: 'xl',
    cell: (e) => <ActorCell e={e} />,
  },
];

/** Pul bilan bog'liq qo'lda amallar jurnali (`audit_logs`) — LEGAL-COMPLIANCE §12. */
export default function AuditLogPage() {
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
      setError('Amallar jurnalini yuklab boʻlmadi');
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
        title="Amallar jurnali"
        description="Hamyonni qoʻlda tuzatish, smenani bekor qilish, STIR oʻzgarishi va karta qaytarimi — kim, qachon, qancha va nima uchun"
      />
      <DataTable
        ariaLabel="Amallar jurnali"
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
          title: 'Jurnal boʻsh',
          description: 'Hamyon qoʻlda tuzatilganda yoki smena bekor qilinganda yozuv shu yerda paydo boʻladi.',
        }}
        toolbar={
          <div className="flex flex-wrap items-start gap-2">
            <Select
              aria-label="Amal turi"
              options={ACTION_OPTIONS}
              value={action}
              onChange={(e) => change(setAction)(e.target.value)}
              wrapperClassName="w-56"
            />
            <Select
              aria-label="Obyekt turi"
              options={TARGET_OPTIONS}
              value={targetType}
              onChange={(e) => change(setTargetType)(e.target.value)}
              wrapperClassName="w-44"
            />
            <Input
              aria-label="Obyekt ID"
              placeholder="Obyekt ID (toʻliq UUID)"
              mono
              value={targetId}
              error={targetIdValid ? undefined : 'Toʻliq UUID kiriting'}
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
