'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { History, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { DateRangeFilter, EMPTY_DATE_RANGE, type DateRangeValue } from '@/components/ui/DateRangeFilter';
import { FilterChip } from '@/components/ui/FilterChip';
import { Input } from '@/components/ui/Input';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton';
import { usePagination } from '@/hooks/usePagination';
import { auditLogApi, type AuditLogEntry } from '@/lib/compliance-api';
import { isUuid } from '@/lib/compliance';
import { auditActionLabels, auditTargetLabels, labelOf } from '@/lib/compliance-labels';
import { auditActorView } from '@/lib/audit-actor';
import { auditChanges, auditRangeParams } from '@/lib/audit-diff';
import { permissionShortLabels } from '@/lib/permission-labels';
import type { Permission } from '@/lib/api';
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

/** Obyekt turi → admin paneldagi sahifasi (bor bo'lsa). */
function targetHref(e: AuditLogEntry): string | null {
  if (!e.targetId) return null;
  if (e.targetType === 'driver') return `/dashboard/drivers/${e.targetId}`;
  if (e.targetType === 'withdrawal') return '/dashboard/withdrawals';
  return null;
}

function TargetCell({ e }: { e: AuditLogEntry }) {
  const label = labelOf(auditTargetLabels(), e.targetType);
  const href = targetHref(e);
  return (
    <span>
      {label}{' '}
      {href ? (
        <Link href={href} className="font-mono text-xs text-primary-text hover:underline">
          {shortId(e.targetId)}
        </Link>
      ) : (
        <span className="font-mono text-xs text-muted">{shortId(e.targetId)}</span>
      )}
    </span>
  );
}

/**
 * Kim bajardi: ism + rol. Ism bosilsa — shu xodimning barcha amallari
 * (filtr URL'ga yoziladi, ya'ni "Akmal kecha nima qildi" bitta havola).
 * Tizim amali odamnikidan boshqacha ko'rinadi.
 */
function ActorCell({ e, onPick }: { e: AuditLogEntry; onPick: (id: string, name: string) => void }) {
  const view = auditActorView(e.actor, e.actorUserId, formatPhone);
  if (view.isSystem) return <Badge variant="neutral">{t().audit.actor.system}</Badge>;
  return (
    <div className="min-w-0 leading-tight">
      {e.actorUserId ? (
        <button
          type="button"
          title={t().audit.filterByActor}
          onClick={() => onPick(e.actorUserId as string, view.name)}
          className="max-w-full truncate text-left text-ink hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-[3px]"
        >
          {view.name}
        </button>
      ) : (
        <p className="truncate text-ink">{view.name}</p>
      )}
      {view.role && <p className="text-xs text-muted">{view.role}</p>}
    </div>
  );
}

/** Izoh + o'zgarish: ruxsatlar uchun +/− ro'yxati, maydonlar uchun "oldin → keyin". */
function DetailCell({ e }: { e: AuditLogEntry }) {
  const m = t().audit;
  const changes = auditChanges(e.action, e.metadata);
  return (
    <div className="min-w-0 space-y-1">
      {e.note && (
        <p className="truncate text-ink" title={e.note}>
          {e.note}
        </p>
      )}
      {changes?.kind === 'permissions' && (
        <p className="text-xs leading-relaxed">
          {changes.added.length > 0 && (
            <span className="mr-2">
              <span className="text-muted">{m.added}: </span>
              {changes.added.map((p) => permissionShortLabels()[p as Permission] ?? p).join(', ')}
            </span>
          )}
          {changes.removed.length > 0 && (
            <span>
              <span className="text-muted">{m.removed}: </span>
              {changes.removed.map((p) => permissionShortLabels()[p as Permission] ?? p).join(', ')}
            </span>
          )}
        </p>
      )}
      {changes?.kind === 'fields' && (
        <ul className="text-xs">
          {changes.fields.map((f) => (
            <li key={f.field} className="truncate">
              <span className="text-muted">{f.field}: </span>
              <span className="num line-through decoration-subtle text-muted">{f.before}</span>
              <span aria-hidden className="mx-1 text-subtle">→</span>
              <span className="num text-ink">{f.after}</span>
            </li>
          ))}
        </ul>
      )}
      {!e.note && !changes && <span className="text-subtle">—</span>}
    </div>
  );
}

function auditColumns(onPickActor: (id: string, name: string) => void): DataTableColumn<AuditLogEntry>[] {
  const m = t().audit;
  return [
    {
      key: 'createdAt',
      header: m.colDate,
      cell: (e) => <span className="num whitespace-nowrap text-muted">{formatDateTime(e.createdAt, { withYear: true })}</span>,
    },
    // "Kim" — jurnalning asosiy savoli, shuning uchun ikkinchi va hech qachon yashirilmaydi.
    { key: 'actor', header: m.colActor, cell: (e) => <ActorCell e={e} onPick={onPickActor} /> },
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
    { key: 'note', header: m.colNote, className: 'max-w-[340px]', cell: (e) => <DetailCell e={e} /> },
  ];
}

function rangeFromParams(params: URLSearchParams): DateRangeValue {
  const from = params.get('from');
  const to = params.get('to');
  return from || to ? { preset: 'custom', from, to } : EMPTY_DATE_RANGE;
}

/** Xodimlar amallari jurnali (`audit_logs`) — LEGAL-COMPLIANCE §12. Faqat o'qish uchun. */
function AuditLogPageInner() {
  const m = t().audit;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pagination = usePagination(20);
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState(() => searchParams.get('action') ?? '');
  const [targetType, setTargetType] = useState(() => searchParams.get('targetType') ?? '');
  const [targetId, setTargetId] = useState(() => searchParams.get('targetId') ?? '');
  // Qo'lda tahrirlangan URL'dagi noto'g'ri ID backend'da 400 beradi — boshidayoq tashlanadi.
  const [actorId, setActorId] = useState(() => {
    const id = searchParams.get('actor') ?? '';
    return isUuid(id) ? id : '';
  });
  const [actorName, setActorName] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangeValue>(() => rangeFromParams(searchParams));

  const targetIdValid = targetId.trim() === '' || isUuid(targetId);

  // Filtrlar URL'da — sahifani ulashish yoki yangilash ularni yo'qotmaydi.
  useEffect(() => {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (targetType) params.set('targetType', targetType);
    if (targetId.trim() && targetIdValid) params.set('targetId', targetId.trim());
    if (actorId) params.set('actor', actorId);
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [action, targetType, targetId, targetIdValid, actorId, range.from, range.to, pathname, router]);

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
        actorUserId: actorId || undefined,
        ...auditRangeParams(range.from, range.to),
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
  }, [pagination.page, pagination.limit, action, targetType, targetId, targetIdValid, actorId, range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    pagination.reset();
  };

  const pickActor = useCallback(
    (id: string, name: string) => {
      setActorId(id);
      setActorName(name);
      pagination.reset();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const columns = useMemo(() => auditColumns(pickActor), [pickActor]);

  // URL'dan kelgan aktyorning ismi — sahifadagi qatorlardan topiladi.
  const actorLabel = useMemo(() => {
    if (!actorId) return null;
    if (actorName) return m.actorChip(actorName);
    const row = rows.find((r) => r.actorUserId === actorId);
    return row ? m.actorChip(auditActorView(row.actor, row.actorUserId, formatPhone).name) : m.actorChipUnknown;
  }, [actorId, actorName, rows, m]);

  const isFiltered = !!action || !!targetType || targetId.trim() !== '' || !!actorId || !!range.from || !!range.to;

  const clearAll = () => {
    setAction('');
    setTargetType('');
    setTargetId('');
    setActorId('');
    setActorName(null);
    setRange(EMPTY_DATE_RANGE);
    pagination.reset();
  };

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title={m.title} description={m.description} />
      <p className="mb-3 -mt-2 flex items-center gap-1.5 text-xs text-muted">
        <Lock size={12} aria-hidden />
        {m.appendOnly}
      </p>
      <DataTable
        ariaLabel={m.title}
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        loading={isLoading}
        error={error}
        onRetry={load}
        isFiltered={isFiltered}
        onClearFilters={clearAll}
        empty={{
          variant: 'first-use',
          icon: <History aria-hidden />,
          title: m.emptyTitle,
          description: m.emptyDesc,
        }}
        toolbar={
          <div className="space-y-2">
            <div className="flex flex-wrap items-start gap-2">
              <Select
                aria-label={m.actionType}
                options={actionOptions()}
                value={action}
                onChange={(e) => change(setAction)(e.target.value)}
                wrapperClassName="w-60"
              />
              <Select
                aria-label={m.targetType}
                options={targetOptions()}
                value={targetType}
                onChange={(e) => change(setTargetType)(e.target.value)}
                wrapperClassName="w-48"
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
              <DateRangeFilter
                value={range}
                onChange={(v) => {
                  setRange(v);
                  pagination.reset();
                }}
              />
            </div>
            {actorLabel && (
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  label={actorLabel}
                  onRemove={() => {
                    setActorId('');
                    setActorName(null);
                    pagination.reset();
                  }}
                />
              </div>
            )}
          </div>
        }
        maxHeightClassName="max-h-[calc(100vh-300px)]"
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

export default function AuditLogPage() {
  // useSearchParams Next 14 build'ida Suspense chegarasini talab qiladi.
  return (
    <Suspense
      fallback={
        <div className="px-4 sm:px-6 py-5 space-y-5">
          <Skeleton className="h-5 w-40" />
          <SkeletonTable rows={10} cols={6} />
        </div>
      }
    >
      <AuditLogPageInner />
    </Suspense>
  );
}
