'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  Star,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { getDriverRoster, approveDriverProfile, getCurrentUserProfile, DriverProfile } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { DriverFinanceModal } from '@/components/drivers/DriverFinanceModal';
import { DriverTierModal, tierLabel } from '@/components/drivers/DriverTierModal';
import { Tabs } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChip } from '@/components/ui/FilterChip';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatNumber, formatPhone, formatRating } from '@/lib/format';

const PAGE_SIZES = [20, 50, 100] as const;

type StatusFilter = '' | 'pending' | 'active' | 'blocked';

// Quick status filters above the table; the working set (tasdiq kutmoqda)
// sits second so it is one click away all shift.
const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Hammasi' },
  { value: 'pending', label: 'Tasdiq kutmoqda' },
  { value: 'active', label: 'Faol' },
  { value: 'blocked', label: 'Bloklangan' },
];

// Amber is reserved for manual override alone (control-room.md) — a driver
// awaiting review is "needs a look", which is info, not intervention.
const statusVariant: Record<string, BadgeVariant> = {
  pending: 'info',
  active: 'success',
  blocked: 'danger',
};

const statusLabel: Record<string, string> = {
  pending: 'Tasdiq kutmoqda',
  active: 'Faol',
  blocked: 'Bloklangan',
};

// First column is the human identifier (driver name), per data-tables.md.
const HEADERS: { label: string; align?: 'right' }[] = [
  { label: 'Haydovchi' },
  { label: 'Mashina' },
  { label: 'Tarif darajasi' },
  { label: 'Reyting', align: 'right' },
  { label: 'Safarlar', align: 'right' },
  { label: 'Status' },
  { label: 'Onlayn' },
  { label: '' },
];

export default function DriverRosterPage() {
  const { toast } = useToast();

  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [canManageFinance, setCanManageFinance] = useState(false);

  const [financeTarget, setFinanceTarget] = useState<DriverProfile | null>(null);
  const [tierTarget, setTierTarget] = useState<DriverProfile | null>(null);

  useEffect(() => {
    getCurrentUserProfile()
      .then((profile) => setCanManageFinance(profile.permissions.includes('drivers_finance')))
      .catch(() => setCanManageFinance(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getDriverRoster({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setDrivers(result.drivers);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      console.error('Failed to load drivers:', err);
      // The last good rows stay on screen — a roster that blanks on a failed
      // refresh is lying; the banner names the failure and offers retry.
      setError('Haydovchilar roʻyxatini yuklab boʻlmadi.');
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [page, pageSize, statusFilter, search]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, pageSize]);

  const handleApprove = async (driver: DriverProfile) => {
    setApprovingId(driver.id);
    try {
      await approveDriverProfile(driver.id);
      setDrivers((prev) => prev.map((d) => (d.id === driver.id ? { ...d, status: 'active' } : d)));
      toast({
        title: `${driver.firstName} ${driver.lastName} tasdiqlandi`,
        description: 'Haydovchi endi buyurtma qabul qila oladi.',
        variant: 'success',
      });
    } catch (err) {
      console.error('Approve failed:', err);
      toast({
        title: 'Haydovchini tasdiqlab boʻlmadi',
        description: 'Qayta urinib koʻring yoki ruxsatingizni tekshiring.',
        variant: 'error',
      });
    } finally {
      setApprovingId(null);
    }
  };

  // One merge point for both modals — the server's updated profile is the
  // source of truth for the row after any edit.
  const mergeDriver = (updated: DriverProfile) => {
    setDrivers((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
  };

  // Meaningful default sort (data-tables.md): online drivers first — the ones
  // the dispatcher can actually act on — then by name.
  const rows = useMemo(
    () =>
      [...drivers].sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'uz');
      }),
    [drivers]
  );

  const clearFilters = () => {
    setSearchInput('');
    setStatusFilter('');
  };

  const handleExport = () => {
    if (rows.length === 0) return;
    const header = [
      'Ism',
      'Telefon',
      'Mashina',
      'Davlat raqami',
      'Tarif darajasi',
      'Reyting',
      'Safarlar',
      'Status',
      'Onlayn',
      ...(canManageFinance ? ['Hamyon (soʻm)', 'Komissiya (%)'] : []),
    ];
    downloadCsv(
      'haydovchilar',
      header,
      rows.map((d) => [
        `${d.firstName} ${d.lastName}`,
        formatPhone(d.phone),
        d.carModel,
        d.carNumber,
        tierLabel(d.approvedTariffTier),
        formatRating(d.rating),
        d.totalTrips,
        statusLabel[d.status] ?? d.status,
        d.isOnline ? 'Ha' : 'Yoʻq',
        ...(canManageFinance
          ? [d.walletBalance ?? '', d.commissionRate ?? '']
          : []),
      ])
    );
    toast({
      title: `${rows.length} ta haydovchi CSV faylga eksport qilindi`,
      description: 'Joriy sahifadagi yozuvlar — filtrlar hisobga olingan.',
      variant: 'success',
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (searchInput) {
      chips.push({
        key: 'q',
        label: `Qidiruv: "${searchInput}"`,
        onRemove: () => setSearchInput(''),
      });
    }
    if (statusFilter) {
      chips.push({
        key: 'status',
        label: `Status: ${statusLabel[statusFilter]}`,
        onRemove: () => setStatusFilter(''),
      });
    }
    return chips;
  }, [searchInput, statusFilter]);

  const renderEmpty = () => {
    // Three empties, not one generic void: filtered-to-empty clears filters
    // here; a cleared approval queue is a *good* state; first-use explains.
    if (searchInput) {
      return (
        <EmptyState
          icon={<Users size={22} />}
          title="Filtrga mos haydovchi topilmadi"
          description="Ism, telefon yoki mashina raqamini oʻzgartirib koʻring."
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Filtrlarni tozalash
            </Button>
          }
        />
      );
    }
    if (statusFilter === 'pending') {
      return (
        <EmptyState
          tone="positive"
          icon={<UserCheck size={22} />}
          title="Tasdiq kutayotgan haydovchi yoʻq ✓"
          description="Barcha arizalar koʻrib chiqilgan."
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Barcha haydovchilar
            </Button>
          }
        />
      );
    }
    if (statusFilter) {
      return (
        <EmptyState
          icon={<Users size={22} />}
          title={`«${statusLabel[statusFilter]}» holatida haydovchi yoʻq`}
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Filtrlarni tozalash
            </Button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={<Users size={22} />}
        title="Haydovchilar yoʻq"
        description="Ilova orqali roʻyxatdan oʻtgan haydovchilar shu jadvalda paydo boʻladi."
      />
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4">
        <PageHeader
          title="Haydovchilar"
          icon={<Users size={17} />}
          description={
            canManageFinance
              ? `Jami ${formatNumber(total)} ta haydovchi`
              : `Jami ${formatNumber(total)} ta · balans va komissiya uchun «Drivers Finance» ruxsati kerak`
          }
          className="mb-4"
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
                onClick={fetchDrivers}
                leftIcon={<RefreshCw size={13} />}
              >
                Yangilash
              </Button>
            </>
          }
        />

        <div className="flex items-center gap-3 flex-wrap mb-3">
          <Input
            placeholder="Ism, telefon yoki mashina raqami"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            leftElement={<Search size={14} />}
            className="w-64"
            aria-label="Haydovchilarni qidirish"
          />
          <Tabs
            items={STATUS_TABS}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            size="sm"
          />
        </div>

        {activeChips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {activeChips.map((chip) => (
              <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
            ))}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Hammasini tozalash
            </Button>
          </div>
        )}

        {error && (
          <RetryBanner
            message={error}
            onRetry={fetchDrivers}
            keepsLastData={rows.length > 0}
            className="mb-3"
          />
        )}

        {error && rows.length === 0 ? (
          <ErrorState
            message="Tarmoq yoki server xatosi. Qayta urinib koʻring."
            onRetry={fetchDrivers}
          />
        ) : isLoading && !hasLoadedOnce ? (
          <SkeletonTable rows={8} cols={HEADERS.length - 1} />
        ) : rows.length === 0 ? (
          <Card>{renderEmpty()}</Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            {/* The table owns its scroll region so the header can freeze. */}
            <div className="overflow-auto max-h-[calc(100vh-16rem)]">
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
                  {rows.map((driver) => (
                    <tr key={driver.id} className="hover:bg-surface-2/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar
                            name={`${driver.firstName} ${driver.lastName}`}
                            size="sm"
                            tone={driver.isOnline ? 'mint' : 'muted'}
                          />
                          <div className="min-w-0">
                            <p className="text-ink font-medium truncate">
                              {driver.firstName} {driver.lastName}
                            </p>
                            <p className="text-subtle text-[11px] font-mono">
                              {formatPhone(driver.phone)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                        {driver.carModel} · <span className="font-mono">{driver.carNumber}</span>
                        {driver.carYear != null && (
                          <span className="text-subtle"> · {driver.carYear}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="mint-soft" size="sm">
                          {tierLabel(driver.approvedTariffTier)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-xs text-muted font-mono tabular-nums">
                          <Star size={12} className="text-mint-deep" fill="currentColor" />
                          {formatRating(driver.rating)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs font-mono text-right tabular-nums">
                        {formatNumber(driver.totalTrips)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[driver.status] ?? 'default'} size="sm">
                          {statusLabel[driver.status] ?? driver.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {/* Colour is never the only signal — the label rides
                            with the dot (WCAG 1.4.1). */}
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted whitespace-nowrap">
                          <span
                            aria-hidden
                            className={`h-2.5 w-2.5 rounded-full inline-block ${
                              driver.isOnline ? 'bg-mint-deep' : 'bg-line-strong'
                            }`}
                          />
                          {driver.isOnline ? 'Onlayn' : 'Oflayn'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end">
                          {driver.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleApprove(driver)}
                              isLoading={approvingId === driver.id}
                              leftIcon={<CheckCircle2 size={13} />}
                            >
                              Tasdiqlash
                            </Button>
                          )}
                          {canManageFinance && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setFinanceTarget(driver)}
                              leftIcon={<Wallet size={13} />}
                            >
                              Moliya
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setTierTarget(driver)}
                            leftIcon={<Car size={13} />}
                          >
                            Tarif
                          </Button>
                        </div>
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
                  / jami <span className="font-mono tabular-nums">{formatNumber(total)}</span>{' '}
                  haydovchi
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

      <DriverFinanceModal
        driver={financeTarget}
        onClose={() => setFinanceTarget(null)}
        onUpdated={mergeDriver}
      />

      <DriverTierModal
        driver={tierTarget}
        onClose={() => setTierTarget(null)}
        onUpdated={mergeDriver}
      />
    </div>
  );
}
