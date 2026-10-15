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
import { USER_ROLE_LABELS, UserRole } from '@/lib/constants';

const ROLE_ITEMS = [
  { value: 'all', label: 'Hammasi' },
  { value: 'passenger', label: USER_ROLE_LABELS.passenger },
  { value: 'driver', label: USER_ROLE_LABELS.driver },
  { value: 'admin', label: USER_ROLE_LABELS.admin },
];

function UsersPageInner() {
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
      setError("Foydalanuvchilarni yuklab bo'lmadi");
      toast({ title: 'Xatolik', description: 'Foydalanuvchilarni yuklashda xatolik', variant: 'error' });
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
      label: `Qidiruv: "${search}"`,
      onRemove: () => { setSearchInput(''); setSearch(''); pagination.reset(); },
    });
  }
  if (role !== 'all') {
    chips.push({
      key: 'role',
      label: `Rol: ${USER_ROLE_LABELS[role as UserRole] ?? role}`,
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
        title: 'Foydalanuvchi bloklandi',
        description: `${fullName(blockTarget.firstName, blockTarget.lastName)} endi tizimga kira olmaydi.`,
        variant: 'success',
      });
      setBlockTarget(null);
      setBlockReason('');
      await fetchUsers();
    } catch {
      toast({ title: 'Xatolik', description: 'Bloklashda xatolik', variant: 'error' });
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
        title: 'Blokdan chiqarildi',
        description: `${name} yana tizimga kira oladi.`,
        variant: 'success',
        action: {
          label: 'Qaytarish',
          altText: 'Blokni qaytarish',
          onClick: async () => {
            try {
              await usersApi.block(user.id, prevReason);
              toast({ title: 'Blok qaytarildi', description: `${name} yana bloklandi.`, variant: 'info' });
              await fetchUsers();
            } catch {
              toast({ title: 'Xatolik', description: "Blokni qaytarib bo'lmadi", variant: 'error' });
            }
          },
        },
      });
    } catch {
      toast({ title: 'Xatolik', description: "Blokdan chiqarib bo'lmadi", variant: 'error' });
    }
  };

  const handleExportCsv = () => {
    if (sortedUsers.length === 0) return;
    downloadCsv<User>(
      `foydalanuvchilar-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'Ism', value: (u) => fullName(u.firstName, u.lastName) },
        { header: 'Telefon', value: (u) => u.phone },
        { header: 'Rol', value: (u) => USER_ROLE_LABELS[u.role as UserRole] ?? u.role },
        { header: 'Holat', value: (u) => (u.status === 'active' ? 'Faol' : 'Bloklangan') },
        { header: 'Blok sababi', value: (u) => u.blockReason ?? '' },
        { header: "Ro'yxatdan o'tgan", value: (u) => formatDateTime(u.createdAt, { withYear: true }) },
        { header: 'Buyurtmalar', value: (u) => u.totalOrders ?? '' },
      ],
      sortedUsers
    );
    toast({ title: 'CSV yuklab olindi', description: `${sortedUsers.length} ta qator`, variant: 'success' });
  };

  const closeBlock = () => {
    setBlockTarget(null);
    setBlockReason('');
  };

  const columns: DataTableColumn<User>[] = [
    {
      key: 'name',
      header: 'Foydalanuvchi',
      sortable: true,
      cell: (u) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar firstName={u.firstName} lastName={u.lastName} size="sm" />
          <span className="font-medium text-ink truncate max-w-[240px]">{fullName(u.firstName, u.lastName)}</span>
        </div>
      ),
    },
    { key: 'phone', header: 'Telefon', className: 'num whitespace-nowrap text-muted', cell: (u) => formatPhone(u.phone) },
    {
      key: 'role',
      header: 'Rol',
      cell: (u) => <Badge variant="neutral">{USER_ROLE_LABELS[u.role as UserRole] ?? u.role}</Badge>,
    },
    {
      key: 'status',
      header: 'Holat',
      sortable: true,
      cell: (u) => (
        <span className="inline-flex items-center gap-2 min-w-0">
          <Badge variant={u.status === 'active' ? 'success' : 'danger'} dot>
            {u.status === 'active' ? 'Faol' : 'Bloklangan'}
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
      header: "Ro'yxatdan o'tgan",
      sortable: true,
      hideBelow: 'xl',
      className: 'num whitespace-nowrap text-muted',
      cell: (u) => formatDateShort(u.createdAt),
    },
    {
      key: 'totalOrders',
      header: 'Buyurtmalar',
      numeric: true,
      sortable: true,
      hideBelow: 'xl',
      cell: (u) => (u.totalOrders != null ? formatNumber(u.totalOrders) : '—'),
    },
    {
      key: 'action',
      header: <span className="sr-only">Amal</span>,
      align: 'right',
      cell: (u) =>
        u.status === 'active' ? (
          <Button
            variant="danger-ghost"
            size="sm"
            onClick={() => setBlockTarget(u)}
            leftIcon={<ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Bloklash
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleUnblock(u)}
            leftIcon={<Shield className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Blokdan chiqarish
          </Button>
        ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Foydalanuvchilar"
        description={`Jami: ${formatNumber(pagination.total)} ta`}
        actions={
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={sortedUsers.length === 0}
            leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            CSV eksport
          </Button>
        }
      />

      <DataTable
        ariaLabel="Foydalanuvchilar"
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
            searchPlaceholder="Telefon, ism yoki familiya…"
            searchAriaLabel="Foydalanuvchilarni qidirish"
            chips={chips}
            onClearAll={clearAllFilters}
          >
            <SegmentedControl
              items={ROLE_ITEMS}
              value={role}
              onChange={(v) => {
                setRole(v);
                pagination.reset();
              }}
              ariaLabel="Rol boʻyicha filtr"
            />
          </FilterBar>
        }
        isFiltered={hasActiveFilters}
        onClearFilters={clearAllFilters}
        emptyFiltered={{ title: 'Hech narsa mos kelmadi', description: "Tanlangan filtrlar bo'yicha foydalanuvchi topilmadi." }}
        empty={{
          variant: 'first-use',
          icon: <UsersIcon aria-hidden />,
          title: "Hozircha foydalanuvchi yo'q",
          description: "Ilovada ro'yxatdan o'tgan foydalanuvchilar shu jadvalda ko'rinadi.",
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
        title="Foydalanuvchini bloklash"
        description={
          <>
            <strong className="text-ink">{fullName(blockTarget?.firstName, blockTarget?.lastName)}</strong>{' '}
            bloklanadi: tizimga kira olmaydi va yangi buyurtma bera olmaydi. Keyin istalgan payt blokdan
            chiqarish mumkin.
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeBlock} disabled={actionLoading}>
              Bekor qilish
            </Button>
            <Button
              variant="danger"
              isLoading={actionLoading}
              onClick={handleBlock}
              leftIcon={<ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Bloklash
            </Button>
          </>
        }
      >
        <Input
          label="Sabab (ixtiyoriy)"
          placeholder="Masalan: qoidabuzarlik, spam..."
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
