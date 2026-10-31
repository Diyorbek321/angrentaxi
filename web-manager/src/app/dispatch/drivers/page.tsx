'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Car, CheckCircle2, Download, RefreshCw, Scale, Star, UserCheck, Wallet } from 'lucide-react';
import { getDriverRoster, approveDriverProfile, getCurrentUserProfile, DriverProfile } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { DriverFinanceModal } from '@/components/drivers/DriverFinanceModal';
import { DriverTierModal, tierLabel } from '@/components/drivers/DriverTierModal';
import { DriverLegalDrawer } from '@/components/drivers/DriverLegalDrawer';
import { legalBriefBadge, legalBriefFromEligibility } from '@/lib/driver-legal';
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
import { t } from '@/locales';
import { getLocale } from '@/lib/i18n/core';

const PAGE_SIZES = [20, 50, 100] as const;

type StatusFilter = '' | 'pending' | 'active' | 'blocked';

// Quick status filters above the table; the working set (tasdiq kutmoqda)
// sits second so it is one click away all shift.
function statusTabs(): readonly { value: StatusFilter; label: string }[] {
  const m = t();
  return [
    { value: '', label: m.common.all },
    { value: 'pending', label: m.drivers.list.status.pending },
    { value: 'active', label: m.drivers.list.status.active },
    { value: 'blocked', label: m.drivers.list.status.blocked },
  ];
}

// Amber is reserved for manual override alone (control-room.md) — a driver
// awaiting review is "needs a look", which is info, not intervention.
const statusVariant: Record<string, BadgeVariant> = {
  pending: 'info',
  active: 'success',
  blocked: 'danger',
};

export default function DriverRosterPage() {
  const m = t();
  const l = m.drivers.list;
  const statusLabel: Record<string, string> = l.status;
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
  const [canApprove, setCanApprove] = useState(false);

  const [financeTarget, setFinanceTarget] = useState<DriverProfile | null>(null);
  const [tierTarget, setTierTarget] = useState<DriverProfile | null>(null);
  const [legalTarget, setLegalTarget] = useState<DriverProfile | null>(null);

  useEffect(() => {
    getCurrentUserProfile()
      .then((profile) => {
        setCanManageFinance(profile.permissions.includes('drivers_finance'));
        setCanApprove(profile.permissions.includes('drivers_approve'));
      })
      .catch(() => {
        setCanManageFinance(false);
        setCanApprove(false);
      });
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
      setError(l.loadError);
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
        title: l.approved(fullName(driver.firstName, driver.lastName)),
        description: l.approvedDesc,
        variant: 'success',
      });
    } catch (err) {
      console.error('Approve failed:', err);
      toast({
        title: l.approveError,
        description: l.approveErrorDesc,
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
        return fullName(a.firstName, a.lastName).localeCompare(fullName(b.firstName, b.lastName), getLocale());
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
      l.csv.name,
      l.csv.phone,
      l.csv.car,
      l.csv.plate,
      l.csv.tier,
      l.csv.rating,
      l.csv.trips,
      l.csv.status,
      l.csv.online,
      ...(canManageFinance ? [l.csv.wallet, l.csv.commission] : []),
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
        d.isOnline ? m.common.yes : m.common.no,
        ...(canManageFinance
          ? [d.walletBalance ?? '', d.commissionRate ?? '']
          : []),
      ])
    );
    toast({
      title: l.exported(rows.length),
      description: l.exportedDesc,
      variant: 'success',
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (searchInput) {
      chips.push({
        key: 'q',
        label: l.chipSearch(searchInput),
        onRemove: () => setSearchInput(''),
      });
    }
    if (statusFilter) {
      chips.push({
        key: 'status',
        label: l.chipStatus(statusLabel[statusFilter]),
        onRemove: () => setStatusFilter(''),
      });
    }
    return chips;
  }, [searchInput, statusFilter, l, statusLabel]);

  // Three empties, not one generic void: filtered-to-empty clears filters
  // here; a cleared approval queue is a *good* state; first-use explains.
  const empty: EmptyStateProps = searchInput
    ? {
        variant: 'no-results',
        title: l.emptyFiltered,
        description: l.emptyFilteredDesc,
        onClearFilters: clearFilters,
      }
    : statusFilter === 'pending'
    ? {
        variant: 'cleared',
        icon: <UserCheck aria-hidden />,
        title: l.emptyPending,
        description: l.emptyPendingDesc,
        action: (
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            {l.allDrivers}
          </Button>
        ),
      }
    : statusFilter
    ? {
        variant: 'no-results',
        title: l.emptyStatus(statusLabel[statusFilter]),
        onClearFilters: clearFilters,
      }
    : {
        variant: 'first-use',
        title: l.emptyFirst,
        description: l.emptyFirstDesc,
      };

  // First column is the human identifier (driver name), per data-tables.md.
  const columns: DataTableColumn<DriverProfile>[] = [
    {
      key: 'name',
      header: l.col.driver,
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
      header: l.col.car,
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
      header: l.col.tier,
      hideBelow: 'xl',
      cell: (d) => (
        <Badge variant="neutral" size="sm">
          {tierLabel(d.approvedTariffTier)}
        </Badge>
      ),
    },
    {
      key: 'rating',
      header: l.col.rating,
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
      header: l.col.trips,
      numeric: true,
      hideBelow: 'xl',
      cell: (d) => <span className="text-muted">{formatNumber(d.totalTrips)}</span>,
    },
    {
      key: 'status',
      header: l.col.status,
      cell: (d) => (
        <Badge variant={statusVariant[d.status] ?? 'neutral'} size="sm">
          {statusLabel[d.status] ?? d.status}
        </Badge>
      ),
    },
    {
      key: 'legal',
      header: l.col.legal,
      hideBelow: 'lg',
      cell: (d) => {
        // Roster carries a brief per driver (§22); the drawer fetches the full list.
        const badge = legalBriefBadge(d.legal);
        return (
          <button
            type="button"
            onClick={() => setLegalTarget(d)}
            title={badge.title}
            aria-label={l.legalAria(badge.label)}
            className="rounded-ds-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Badge variant={badge.variant} size="sm">
              {badge.label}
            </Badge>
          </button>
        );
      },
    },
    {
      key: 'online',
      header: l.col.online,
      hideBelow: 'md',
      // Colour is never the only signal — the label rides with the dot.
      cell: (d) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted whitespace-nowrap">
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full inline-block ${d.isOnline ? 'bg-mint-deep' : 'bg-line-strong'}`}
          />
          {d.isOnline ? l.online : l.offline}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{l.col.actions}</span>,
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
              {m.common.confirm}
            </Button>
          )}
          {canManageFinance && (
            <Tooltip content={l.finance}>
              <IconButton
                aria-label={l.financeAria(fullName(d.firstName, d.lastName))}
                icon={<Wallet aria-hidden />}
                onClick={() => setFinanceTarget(d)}
              />
            </Tooltip>
          )}
          <Tooltip content={l.legalProfile}>
            <IconButton
              aria-label={l.legalProfileAria(fullName(d.firstName, d.lastName))}
              icon={<Scale aria-hidden />}
              onClick={() => setLegalTarget(d)}
            />
          </Tooltip>
          <Tooltip content={l.col.tier}>
            <IconButton
              aria-label={l.tierAria(fullName(d.firstName, d.lastName))}
              icon={<Car aria-hidden />}
              onClick={() => setTierTarget(d)}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title={l.title}
        description={
          canManageFinance
            ? l.total(formatNumber(total))
            : l.totalNoFinance(formatNumber(total))
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={rows.length === 0}
              leftIcon={<Download size={13} aria-hidden />}
              title={l.exportTitle}
            >
              {l.export}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchDrivers}
              isLoading={isLoading && hasLoadedOnce}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              {m.common.refresh}
            </Button>
          </>
        }
      />

      <FilterBar
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={l.searchPlaceholder}
        chips={activeChips}
        onClearAll={clearFilters}
        className="mb-3"
      >
        <SegmentedControl
          items={statusTabs()}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel={l.statusFilterAria}
        />
      </FilterBar>

      <DataTable
        ariaLabel={l.title}
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

      <DriverLegalDrawer
        driver={legalTarget}
        canEdit={canApprove}
        onClose={() => setLegalTarget(null)}
        onUpdated={(id, summary) =>
          setDrivers((prev) =>
            prev.map((d) => (d.id === id ? { ...d, legal: legalBriefFromEligibility(summary.eligibility) } : d))
          )
        }
      />

      <DriverTierModal
        driver={tierTarget}
        onClose={() => setTierTarget(null)}
        onUpdated={mergeDriver}
      />
    </PageBody>
  );
}
