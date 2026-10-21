'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Shield, ShieldOff, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { FilterChip } from '@/components/ui/FilterChips';
import { DataTable, type DataTableColumn, type SortState } from '@/components/ui/DataTable';
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton';
import { usersApi, User } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { debounce } from '@/lib/utils';
import { formatDateShort, formatDateTime, formatNumber, formatPhone, fullName } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { userRoleLabels, UserRole } from '@/lib/constants';
import { t } from '@/locales';

const roleItems = () => [
  { value: 'all', label: t().users.all },
  { value: 'passenger', label: userRoleLabels().passenger },
  { value: 'driver', label: userRoleLabels().driver },
  { value: 'admin', label: userRoleLabels().admin },
];

function UsersPageInner() {
  const m = t();
  const u0 = m.users;
  const { toast } = useToast();
  const searchParams = useSearchParams();
  // `?q=` — topbar qidiruvidan chuqur havola.
  const initialQuery = searchParams.get('q')?.trim() ?? '';
  const pagination = usePagination(20);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery);
  const [role, setRole] = useState<string>('all');
  // Tasdiqlash modali FAQAT bloklash uchun — u og'ir oqibatli amal.
  // Blokdan chiqarish darhol bajariladi va undo-toast bilan himoyalanadi.
  const [blockTarget, setBlockTarget] = useState<User | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [sort, setSort] = useState<SortState | null>(null);

  // A new topbar search while already on this page.
  useEffect(() => {
    setSearchInput(initialQuery);
    setSearch(initialQuery);
  }, [initialQuery]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        role: role !== 'all' ? role : undefined,
      });
      const payload = res.data.data;
      setUsers(payload?.users ?? []);
      const total = payload?.total ?? 0;
      pagination.setTotal(total, Math.ceil(total / pagination.limit));
      setError(null);
    } catch {
      // Oxirgi muvaffaqiyatli qatorlar ekranda qoladi; banner + retry chiqadi.
      setError(u0.loadError);
      toast({ title: m.common.error, description: u0.loadErrorToast, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, search, role]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const paginationReset = pagination.reset;
  const debouncedSearch = useRef(
    debounce((value: string) => {
      setSearch(value);
      paginationReset();
    }, 400)
  ).current;

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedSearch(value);
  };

  // Sahifadagi yuklangan qatorlar ustida, mijoz tomonida tartiblash.
  const sortedUsers = useMemo(() => {
    if (!sort) return users;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...users].sort((a, b) => {
      switch (sort.key) {
        case 'name':
          return fullName(a.firstName, a.lastName).localeCompare(fullName(b.firstName, b.lastName)) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'createdAt':
          return a.createdAt.localeCompare(b.createdAt) * dir;
        case 'totalOrders':
          return ((a.totalOrders ?? 0) - (b.totalOrders ?? 0)) * dir;
        default:
          return 0;
      }
    });
  }, [users, sort]);

  const clearAllFilters = () => {
    setSearchInput('');
    setSearch('');
    setRole('all');
    pagination.reset();
  };

  const chips: FilterChip[] = [];
  if (search) {
    chips.push({
      key: 'search',
      label: u0.chipSearch(search),
      onRemove: () => { setSearchInput(''); setSearch(''); pagination.reset(); },
    });
  }
  if (role !== 'all') {
    chips.push({
      key: 'role',
      label: u0.chipRole(userRoleLabels()[role as UserRole] ?? role),
      onRemove: () => { setRole('all'); pagination.reset(); },
    });
  }
  const hasActiveFilters = chips.length > 0;

  const handleBlock = async () => {
    if (!blockTarget) return;
    setActionLoading(true);
    try {
      await usersApi.block(blockTarget.id, blockReason.trim() || undefined);
      toast({
        title: u0.blocked,
        description: u0.blockedDesc(fullName(blockTarget.firstName, blockTarget.lastName)),
        variant: 'success',
      });
      setBlockTarget(null);
      setBlockReason('');
      await fetchUsers();
    } catch {
      toast({ title: m.common.error, description: u0.blockFailed, variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Blokdan chiqarish — qaytariladigan amal: modal YO'Q, darhol bajariladi,
  // toast esa "Qaytarish" (undo) tugmasini taklif qiladi (avvalgi sabab bilan
  // qayta bloklaydi).
  const handleUnblock = async (user: User) => {
    const name = fullName(user.firstName, user.lastName);
    const prevReason = user.blockReason ?? undefined;
    try {
      await usersApi.unblock(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: 'active', blockReason: null } : u))
      );
      toast({
        title: u0.unblocked,
        description: u0.unblockedDesc(name),
        variant: 'success',
        action: {
          label: u0.undo,
          altText: u0.undoAlt,
          onClick: async () => {
            try {
              await usersApi.block(user.id, prevReason);
              toast({ title: u0.reblocked, description: u0.reblockedDesc(name), variant: 'info' });
              await fetchUsers();
            } catch {
              toast({ title: m.common.error, description: u0.reblockFailed, variant: 'error' });
            }
          },
        },
      });
    } catch {
      toast({ title: m.common.error, description: u0.unblockFailed, variant: 'error' });
    }
  };

  const handleExportCsv = () => {
    if (sortedUsers.length === 0) return;
    downloadCsv<User>(
      u0.csvFile(new Date().toISOString().slice(0, 10)),
      [
        { header: u0.colName, value: (u) => fullName(u.firstName, u.lastName) },
        { header: u0.colPhone, value: (u) => u.phone },
        { header: u0.colRole, value: (u) => userRoleLabels()[u.role as UserRole] ?? u.role },
        { header: u0.colStatus, value: (u) => (u.status === 'active' ? u0.statusActive : u0.statusBlocked) },
        { header: u0.colBlockReason, value: (u) => u.blockReason ?? '' },
        { header: u0.colRegistered, value: (u) => formatDateTime(u.createdAt, { withYear: true }) },
        { header: u0.colOrders, value: (u) => u.totalOrders ?? '' },
      ],
      sortedUsers
    );
    toast({ title: u0.csvDone, description: u0.csvRows(sortedUsers.length), variant: 'success' });
  };

  const closeBlock = () => {
    setBlockTarget(null);
    setBlockReason('');
  };

  const columns: DataTableColumn<User>[] = [
    {
      key: 'name',
      header: u0.colUser,
      sortable: true,
      cell: (u) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar firstName={u.firstName} lastName={u.lastName} size="sm" />
          <span className="font-medium text-ink truncate max-w-[240px]">{fullName(u.firstName, u.lastName)}</span>
        </div>
      ),
    },
    { key: 'phone', header: u0.colPhone, className: 'num whitespace-nowrap text-muted', cell: (u) => formatPhone(u.phone) },
    {
      key: 'role',
      header: u0.colRole,
      cell: (u) => <Badge variant="neutral">{userRoleLabels()[u.role as UserRole] ?? u.role}</Badge>,
    },
    {
      key: 'status',
      header: u0.colStatus,
      sortable: true,
      cell: (u) => (
        <span className="inline-flex items-center gap-2 min-w-0">
          <Badge variant={u.status === 'active' ? 'success' : 'danger'} dot>
            {u.status === 'active' ? u0.statusActive : u0.statusBlocked}
          </Badge>
          {u.status === 'blocked' && u.blockReason && (
            <span className="max-w-[160px] truncate text-xs text-subtle" title={u.blockReason}>
              {u.blockReason}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: u0.colRegistered,
      sortable: true,
      hideBelow: 'xl',
      className: 'num whitespace-nowrap text-muted',
      cell: (u) => formatDateShort(u.createdAt),
    },
    {
      key: 'totalOrders',
      header: u0.colOrders,
      numeric: true,
      sortable: true,
      hideBelow: 'xl',
      cell: (u) => (u.totalOrders != null ? formatNumber(u.totalOrders) : '—'),
    },
    {
      key: 'action',
      header: <span className="sr-only">{u0.colAction}</span>,
      align: 'right',
      cell: (u) =>
        u.status === 'active' ? (
          <Button
            variant="danger-ghost"
            size="sm"
            onClick={() => setBlockTarget(u)}
            leftIcon={<ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            {u0.block}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleUnblock(u)}
            leftIcon={<Shield className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            {u0.unblock}
          </Button>
        ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={u0.title}
        description={u0.total(formatNumber(pagination.total))}
        actions={
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={sortedUsers.length === 0}
            leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            {u0.exportCsv}
          </Button>
        }
      />

      <DataTable
        ariaLabel={u0.title}
        columns={columns}
        rows={sortedUsers}
        rowKey={(u) => u.id}
        loading={isLoading}
        error={error}
        onRetry={fetchUsers}
        sort={sort}
        onSortChange={setSort}
        maxHeightClassName="max-h-[calc(100vh-260px)]"
        toolbar={
          <FilterBar
            search={searchInput}
            onSearchChange={handleSearchChange}
            searchPlaceholder={u0.searchPlaceholder}
            searchAriaLabel={u0.searchAria}
            chips={chips}
            onClearAll={clearAllFilters}
          >
            <SegmentedControl
              items={roleItems()}
              value={role}
              onChange={(v) => {
                setRole(v);
                pagination.reset();
              }}
              ariaLabel={u0.roleFilter}
            />
          </FilterBar>
        }
        isFiltered={hasActiveFilters}
        onClearFilters={clearAllFilters}
        emptyFiltered={{ title: u0.noMatchTitle, description: u0.noMatchDesc }}
        empty={{
          variant: 'first-use',
          icon: <UsersIcon aria-hidden />,
          title: u0.emptyTitle,
          description: u0.emptyDesc,
        }}
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

      {/* Bloklash — OG'IR OQIBATLI amal: modal oqibatni aniq aytadi. */}
      <Modal
        isOpen={!!blockTarget}
        onClose={closeBlock}
        tone="danger"
        title={u0.blockTitle}
        description={
          <>
            <strong className="text-ink">{fullName(blockTarget?.firstName, blockTarget?.lastName)}</strong>{' '}
            {u0.blockBody}
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeBlock} disabled={actionLoading}>
              {m.common.cancel}
            </Button>
            <Button
              variant="danger"
              isLoading={actionLoading}
              onClick={handleBlock}
              leftIcon={<ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              {u0.block}
            </Button>
          </>
        }
      >
        <Input
          label={u0.reason}
          placeholder={u0.reasonPlaceholder}
          value={blockReason}
          onChange={(e) => setBlockReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}

export default function UsersPage() {
  // useSearchParams Next 14 build'ida Suspense chegarasini talab qiladi.
  return (
    <Suspense
      fallback={
        <div className="px-4 sm:px-6 py-5 space-y-5">
          <Skeleton className="h-5 w-40" />
          <SkeletonTable rows={10} cols={7} />
        </div>
      }
    >
      <UsersPageInner />
    </Suspense>
  );
}
