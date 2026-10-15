'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Car, CheckCircle2, Download, RefreshCw, Star, UserCheck, Wallet } from 'lucide-react';
import { getDriverRoster, approveDriverProfile, getCurrentUserProfile, DriverProfile } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { DriverFinanceModal } from '@/components/drivers/DriverFinanceModal';
import { DriverTierModal, tierLabel } from '@/components/drivers/DriverTierModal';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/ui/PageHeader';
import type { EmptyStateProps } from '@/components/ui/EmptyState';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { FilterBar } from '@/components/ui/FilterBar';
import { PlateNumber } from '@/components/ui/PlateNumber';
import { PageBody } from '@/components/ui/PageBody';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatNumber, formatPhone, formatRating, fullName } from '@/lib/format';

const PAGE_SIZES = [20, 50, 100] as const;

type StatusFilter = '' | 'pending' | 'active' | 'blocked';

// Quick status filters above the table; the working set (tasdiq kutmoqda)
// sits second so it is one click away all shift.
const STATUS_TABS: readonly { value: StatusFilter; label: string }[] = [
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
        title: `${fullName(driver.firstName, driver.lastName)} tasdiqlandi`,
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
        return fullName(a.firstName, a.lastName).localeCompare(fullName(b.firstName, b.lastName), 'uz');
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
        fullName(d.firstName, d.lastName, ''),
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

  // Three empties, not one generic void: filtered-to-empty clears filters
  // here; a cleared approval queue is a *good* state; first-use explains.
  const empty: EmptyStateProps = searchInput
    ? {
        variant: 'no-results',
        title: 'Filtrga mos haydovchi topilmadi',
        description: 'Ism, telefon yoki mashina raqamini oʻzgartirib koʻring.',
        onClearFilters: clearFilters,
      }
    : statusFilter === 'pending'
    ? {
        variant: 'cleared',
        icon: <UserCheck aria-hidden />,
        title: 'Tasdiq kutayotgan haydovchi yoʻq',
        description: 'Barcha arizalar koʻrib chiqilgan.',
        action: (
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Barcha haydovchilar
          </Button>
        ),
      }
    : statusFilter
    ? {
        variant: 'no-results',
        title: `«${statusLabel[statusFilter]}» holatida haydovchi yoʻq`,
        onClearFilters: clearFilters,
      }
    : {
        variant: 'first-use',
        title: 'Haydovchilar yoʻq',
        description: 'Ilova orqali roʻyxatdan oʻtgan haydovchilar shu jadvalda paydo boʻladi.',
      };

  // First column is the human identifier (driver name), per data-tables.md.
  const columns: DataTableColumn<DriverProfile>[] = [
    {
      key: 'name',
      header: 'Haydovchi',
      cell: (d) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            name={fullName(d.firstName, d.lastName, '')}
            size="sm"
            tone={d.isOnline ? 'mint' : 'muted'}
          />
          <div className="min-w-0">
            <p className="text-ink font-medium truncate">{fullName(d.firstName, d.lastName)}</p>
            <p className="num text-subtle text-xs">{formatPhone(d.phone)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'car',
      header: 'Mashina',
      hideBelow: 'md',
      cell: (d) => (
        <span className="inline-flex items-center gap-2 text-muted whitespace-nowrap">
          {/* Below xl only the plate (the identity) stays — model/year fit 1024px otherwise not. */}
          <span className="hidden xl:inline truncate max-w-[140px]">{d.carModel || '—'}</span>
          <PlateNumber plate={d.carNumber} />
          {d.carYear != null && <span className="hidden xl:inline num text-subtle">{d.carYear}</span>}
        </span>
      ),
    },
    {
      key: 'tier',
      header: 'Tarif darajasi',
      hideBelow: 'xl',
      cell: (d) => (
        <Badge variant="neutral" size="sm">
          {tierLabel(d.approvedTariffTier)}
        </Badge>
      ),
    },
    {
      key: 'rating',
      header: 'Reyting',
      numeric: true,
      cell: (d) => (
        <span className="inline-flex items-center gap-1 text-muted">
          <Star size={12} className="text-mint-deep" fill="currentColor" aria-hidden />
          {formatRating(d.rating)}
        </span>
      ),
    },
    {
      key: 'trips',
      header: 'Safarlar',
      numeric: true,
      hideBelow: 'xl',
      cell: (d) => <span className="text-muted">{formatNumber(d.totalTrips)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (d) => (
        <Badge variant={statusVariant[d.status] ?? 'neutral'} size="sm">
          {statusLabel[d.status] ?? d.status}
        </Badge>
      ),
    },
    {
      key: 'online',
      header: 'Onlayn',
      hideBelow: 'md',
      // Colour is never the only signal — the label rides with the dot.
      cell: (d) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted whitespace-nowrap">
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full inline-block ${d.isOnline ? 'bg-mint-deep' : 'bg-line-strong'}`}
          />
          {d.isOnline ? 'Onlayn' : 'Oflayn'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amallar</span>,
      align: 'right',
      cell: (d) => (
        <div className="flex gap-1 justify-end">
          {d.status === 'pending' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleApprove(d)}
              isLoading={approvingId === d.id}
              leftIcon={<CheckCircle2 size={13} aria-hidden />}
            >
              Tasdiqlash
            </Button>
          )}
          {canManageFinance && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFinanceTarget(d)}
              leftIcon={<Wallet size={13} aria-hidden />}
            >
              Moliya
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTierTarget(d)}
            leftIcon={<Car size={13} aria-hidden />}
          >
            Tarif
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Haydovchilar"
        description={
          canManageFinance
            ? `Jami ${formatNumber(total)} ta haydovchi`
            : `Jami ${formatNumber(total)} ta · balans va komissiya uchun «Drivers Finance» ruxsati kerak`
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={rows.length === 0}
              leftIcon={<Download size={13} aria-hidden />}
              title="Joriy sahifadagi yozuvlarni CSV sifatida yuklab olish"
            >
              CSV eksport
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchDrivers}
              isLoading={isLoading && hasLoadedOnce}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              Yangilash
            </Button>
          </>
        }
      />

      <FilterBar
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Ism, telefon yoki mashina raqami"
        chips={activeChips}
        onClearAll={clearFilters}
        className="mb-3"
      >
        <SegmentedControl
          items={STATUS_TABS}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Status boʻyicha filtr"
        />
      </FilterBar>

      <DataTable
        ariaLabel="Haydovchilar"
        columns={columns}
        rows={rows}
        rowKey={(d) => d.id}
        loading={isLoading && !hasLoadedOnce}
        error={error}
        onRetry={fetchDrivers}
        empty={empty}
        maxHeightClassName="max-h-[calc(100vh-16rem)]"
        pagination={{
          page,
          totalPages,
          total,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
          pageSizeOptions: PAGE_SIZES,
        }}
      />

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
    </PageBody>
  );
}
