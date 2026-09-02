'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Info,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { getAllWithdrawals, WithdrawalRequest, WithdrawalStatus } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatTile } from '@/components/ui/StatTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChip } from '@/components/ui/FilterChip';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime, formatMoney, formatNumber, formatPhone } from '@/lib/format';

const PAGE_SIZES = [20, 50, 100] as const;

type StatusFilter = '' | WithdrawalStatus;

// One colour, one meaning: amber stays with manual override, so a pending
// payout reads as info and the approved → paid progression stays green.
const statusVariant: Record<WithdrawalStatus, BadgeVariant> = {
  pending: 'info',
  approved: 'mint-soft',
  rejected: 'danger',
  paid: 'success',
};

const statusLabel: Record<WithdrawalStatus, string> = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
  paid: 'Toʻlangan',
};

const ownerTypeLabel: Record<string, string> = {
  driver: 'Haydovchi',
  vendor: 'Market sotuvchisi',
  restaurant: 'Restoran',
};

// The queue's working set first: pending is what an operator watches.
const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Hammasi' },
  { value: 'pending', label: 'Kutilmoqda' },
  { value: 'approved', label: 'Tasdiqlangan' },
  { value: 'paid', label: 'Toʻlangan' },
  { value: 'rejected', label: 'Rad etilgan' },
];

const HEADERS: { label: string; align?: 'right' }[] = [
  { label: 'Soʻrovchi' },
  { label: 'Turi' },
  { label: 'Summa', align: 'right' },
  { label: 'Karta / hisob' },
  { label: 'Soʻralgan vaqt' },
  { label: 'Status' },
];

function requesterName(w: WithdrawalRequest): string {
  return [w.driver?.firstName, w.driver?.lastName].filter(Boolean).join(' ') || '—';
}

export default function FinancePage() {
  const { toast } = useToast();

  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAllWithdrawals(page, pageSize, statusFilter || undefined);
      setWithdrawals(result.withdrawals);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      console.error('Failed to load withdrawals:', err);
      setError('Pul yechish soʻrovlarini yuklab boʻlmadi.');
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, pageSize]);

  // Default sort: newest request first — the queue reads top-down.
  const rows = useMemo(
    () =>
      [...withdrawals].sort(
        (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
      ),
    [withdrawals]
  );

  const pending = rows.filter((w) => w.status === 'pending');
  const totalPendingAmount = pending.reduce((sum, w) => sum + w.amount, 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const handleExport = () => {
    if (rows.length === 0) return;
    downloadCsv(
      'pul-yechish-sorovlari',
      ['Soʻrovchi', 'Telefon', 'Turi', 'Summa (soʻm)', 'Karta / hisob', 'Soʻralgan vaqt', 'Status'],
      rows.map((w) => [
        requesterName(w),
        w.driver?.phone ? formatPhone(w.driver.phone) : '',
        ownerTypeLabel[w.ownerType] ?? w.ownerType,
        w.amount,
        w.payoutDestination,
        new Date(w.requestedAt).toLocaleString('uz-UZ'),
        statusLabel[w.status] ?? w.status,
      ])
    );
    toast({
      title: `${rows.length} ta soʻrov CSV faylga eksport qilindi`,
      description: 'Joriy sahifadagi yozuvlar — filtrlar hisobga olingan.',
      variant: 'success',
    });
  };

  const renderEmpty = () => {
    // The cleared queue is a *good* state and says so — it is the one screen
    // where "nothing here" is the outcome the operator is working toward.
    if (statusFilter === 'pending') {
      return (
        <EmptyState
          tone="positive"
          icon={<CheckCircle2 size={22} />}
          title="Barcha soʻrovlar koʻrib chiqildi ✓"
          description="Kutayotgan pul yechish soʻrovi qolmadi."
          action={
            <Button variant="secondary" size="sm" onClick={() => setStatusFilter('')}>
              Barcha soʻrovlar
            </Button>
          }
        />
      );
    }
    if (statusFilter) {
      return (
        <EmptyState
          icon={<Wallet size={22} />}
          title={`«${statusLabel[statusFilter]}» holatidagi soʻrov yoʻq`}
          description="Boshqa statusni tanlab koʻring."
          action={
            <Button variant="secondary" size="sm" onClick={() => setStatusFilter('')}>
              Filtrni tozalash
            </Button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={<Wallet size={22} />}
        title="Pul yechish soʻrovi yoʻq"
        description="Haydovchi yoki sotuvchi pul yechishni soʻraganda shu navbatda koʻrinadi."
      />
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4">
        <PageHeader
          title="Moliya"
          description="Toʻlov navbati — haydovchi, Market sotuvchisi, restoran"
          icon={<DollarSign size={17} />}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={rows.length === 0}
                leftIcon={<Download size={13} />}
                title="Joriy sahifadagi yozuvlarni CSV sifatida yuklab olish"
              >
                CSV eksport
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchData}
                leftIcon={<RefreshCw size={13} />}
              >
                Yangilash
              </Button>
            </>
          }
        />

        {/* Read-only surface — approving/paying happens in the admin panel. */}
        <div className="flex items-start gap-2.5 rounded-ds-xs border border-info/30 bg-info-tint px-3.5 py-3 mb-4">
          <Info size={15} className="text-info shrink-0 mt-0.5" />
          <p className="text-sm text-info-deep dark:text-info-light leading-relaxed">
            Bu sahifa faqat kuzatuv uchun. Toʻlovni tasdiqlash, rad etish yoki «toʻlandi» deb
            belgilash Super Admin panelida bajariladi.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatTile
            label="Kutilayotgan soʻrovlar"
            value={isLoading && !hasLoadedOnce ? '—' : pending.length}
            hint="joriy sahifada"
            tone="info"
            icon={<Wallet size={16} />}
          />
          <StatTile
            label="Kutilayotgan summa"
            value={isLoading && !hasLoadedOnce ? '—' : formatMoney(totalPendingAmount)}
            hint="joriy sahifada"
            tone="mint"
            icon={<DollarSign size={16} />}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap mb-3">
          <Tabs
            items={STATUS_TABS}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            size="sm"
          />
        </div>

        {statusFilter && (
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <FilterChip
              label={`Status: ${statusLabel[statusFilter]}`}
              onRemove={() => setStatusFilter('')}
            />
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter('')}>
              Hammasini tozalash
            </Button>
          </div>
        )}

        {error && (
          <RetryBanner
            message={error}
            onRetry={fetchData}
            keepsLastData={rows.length > 0}
            className="mb-3"
          />
        )}

        {error && rows.length === 0 ? (
          <ErrorState
            message="Tarmoq yoki server xatosi. Qayta urinib koʻring."
            onRetry={fetchData}
          />
        ) : isLoading && !hasLoadedOnce ? (
          <SkeletonTable rows={6} cols={HEADERS.length} />
        ) : rows.length === 0 ? (
          <Card>{renderEmpty()}</Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-22rem)]">
              <table className="w-full text-sm text-left">
                <thead className="text-subtle uppercase text-[10px] tracking-wider">
                  <tr>
                    {HEADERS.map((h, i) => (
                      <th
                        key={i}
                        className={`sticky-th bg-surface-2 px-4 py-3 font-semibold whitespace-nowrap ${
                          h.align === 'right' ? 'text-right' : ''
                        }`}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((w) => (
                    <tr key={w.id} className="hover:bg-surface-2/70 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-ink font-medium">{requesterName(w)}</p>
                        <p className="text-subtle text-[11px] font-mono">
                          {w.driver?.phone ? formatPhone(w.driver.phone) : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default" size="sm">
                          {ownerTypeLabel[w.ownerType] ?? w.ownerType}
                        </Badge>
                      </td>
                      {/* Money: mono, right-aligned, tabular — column scanning. */}
                      <td className="px-4 py-3 font-mono font-semibold text-ink whitespace-nowrap text-right tabular-nums">
                        {formatMoney(w.amount)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {w.payoutDestination}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap tabular-nums">
                        {formatDateTime(w.requestedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[w.status]} size="sm" dot>
                          {statusLabel[w.status] ?? w.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted border-t border-line">
              <div className="flex items-center gap-3">
                <span>
                  <span className="font-mono tabular-nums">
                    {from}–{to}
                  </span>{' '}
                  / jami <span className="font-mono tabular-nums">{formatNumber(total)}</span> soʻrov
                </span>
                <label className="flex items-center gap-1.5">
                  <span className="text-subtle">Sahifada:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    aria-label="Sahifadagi qatorlar soni"
                    className="h-7 rounded-ds-xs border border-line bg-surface px-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-focus/40"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  leftIcon={<ChevronLeft size={13} />}
                >
                  Oldingi
                </Button>
                <span className="px-3 py-1.5 font-mono tabular-nums bg-surface-2 border border-line rounded-ds-xs">
                  {page} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage((p) => p + 1)}
                  rightIcon={<ChevronRight size={13} />}
                >
                  Keyingi
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
