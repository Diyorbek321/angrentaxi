'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Search,
  SearchX,
  Shield,
  ShieldOff,
  Users as UsersIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { FilterChips, type FilterChip } from '@/components/ui/FilterChips';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { usersApi, User } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { cn, debounce, formatDate, formatPhone, getFullName } from '@/lib/utils';
import { downloadCsv } from '@/lib/csv';
import { USER_ROLE_LABELS, UserRole } from '@/lib/constants';

type SortDir = 'asc' | 'desc' | null;

export default function UsersPage() {
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<string>('all');
  // Tasdiqlash modali FAQAT bloklash uchun — u og'ir oqibatli amal.
  // Blokdan chiqarish darhol bajariladi va undo-toast bilan himoyalanadi.
  const [blockTarget, setBlockTarget] = useState<User | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

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
      setHasLoadedOnce(true);
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

  const handleSort = (field: string) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortField(null);
      setSortDir(null);
    }
  };

  // Sahifadagi yuklangan qatorlar ustida, mijoz tomonida tartiblash.
  const sortedUsers = useMemo(() => {
    if (!sortField || !sortDir) return users;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...users].sort((a, b) => {
      switch (sortField) {
        case 'name':
          return getFullName(a.firstName || '', a.lastName || '')
            .localeCompare(getFullName(b.firstName || '', b.lastName || '')) * dir;
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
  }, [users, sortField, sortDir]);

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
        description: `${getFullName(blockTarget.firstName || '', blockTarget.lastName || '')} endi tizimga kira olmaydi.`,
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
    const name = getFullName(user.firstName || '', user.lastName || '');
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
        { header: 'Ism', value: (u) => getFullName(u.firstName || '', u.lastName || '') },
        { header: 'Telefon', value: (u) => u.phone },
        { header: 'Rol', value: (u) => USER_ROLE_LABELS[u.role as UserRole] ?? u.role },
        { header: 'Holat', value: (u) => (u.status === 'active' ? 'Faol' : 'Bloklangan') },
        { header: 'Blok sababi', value: (u) => u.blockReason ?? '' },
        { header: "Ro'yxatdan o'tgan", value: (u) => formatDate(u.createdAt) },
        { header: 'Buyurtmalar', value: (u) => u.totalOrders ?? '' },
      ],
      sortedUsers
    );
    toast({ title: 'CSV yuklab olindi', description: `${sortedUsers.length} ta qator`, variant: 'success' });
  };

  const SortableHead = ({
    field,
    children,
    align = 'left',
  }: {
    field: string;
    children: React.ReactNode;
    align?: 'left' | 'right';
  }) => {
    const active = sortField === field && !!sortDir;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <TableHead
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={align === 'right' ? 'text-right' : undefined}
      >
        <button
          type="button"
          onClick={() => handleSort(field)}
          className={cn(
            'inline-flex items-center gap-1 text-micro uppercase transition-colors duration-fast',
            align === 'right' && 'flex-row-reverse',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2',
            active ? 'text-primary-text' : 'text-muted hover:text-ink'
          )}
        >
          {children}
          <Icon className={cn('h-3 w-3', active ? 'text-primary-text' : 'text-subtle')} aria-hidden="true" />
        </button>
      </TableHead>
    );
  };

  const showFullError = error && !isLoading && users.length === 0 && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && !showFullError;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Foydalanuvchilar"
        description={`Jami: ${pagination.total.toLocaleString('uz-UZ')} ta`}
        icon={<UsersIcon className="h-4 w-4" aria-hidden="true" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={sortedUsers.length === 0}
            leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            CSV eksport
          </Button>
        }
      />
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              placeholder="Telefon, ism yoki familiya bo'yicha qidirish..."
              leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-label="Foydalanuvchilarni qidirish"
            />
          </div>
          <Select value={role} onValueChange={(v) => { setRole(v); pagination.reset(); }}>
            <SelectTrigger className="w-48" aria-label="Rol bo'yicha filtr">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha rollar</SelectItem>
              <SelectItem value="passenger">Yo&apos;lovchi</SelectItem>
              <SelectItem value="driver">Haydovchi</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <FilterChips chips={chips} onClearAll={clearAllFilters} />

        {showErrorBanner && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-4 py-3"
          >
            <p className="flex items-center gap-2 text-body text-danger-deep dark:text-danger-light">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error} — oxirgi muvaffaqiyatli yuklangan ma&apos;lumot ko&apos;rsatilmoqda.
            </p>
            <Button variant="secondary" size="sm" onClick={fetchUsers}>
              Qayta urinish
            </Button>
          </div>
        )}

        {showFullError ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState message={error} onRetry={fetchUsers} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <SkeletonTable rows={8} cols={7} className="border-0" />
              ) : sortedUsers.length === 0 ? (
                hasActiveFilters ? (
                  <EmptyState
                    icon={<SearchX className="h-6 w-6" />}
                    title="Hech narsa mos kelmadi"
                    description="Tanlangan filtrlar bo'yicha foydalanuvchi topilmadi."
                    action={
                      <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                        Filtrlarni tozalash
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<UsersIcon className="h-6 w-6" />}
                    title="Hozircha foydalanuvchi yo'q"
                    description="Ilovada ro'yxatdan o'tgan foydalanuvchilar shu jadvalda ko'rinadi."
                  />
                )
              ) : (
                <Table stickyHeader containerClassName="max-h-[65vh]">
                  <TableHeader>
                    <TableRow>
                      <SortableHead field="name">Foydalanuvchi</SortableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Rol</TableHead>
                      <SortableHead field="status">Holat</SortableHead>
                      <SortableHead field="createdAt">Ro&apos;yxatdan o&apos;tgan</SortableHead>
                      <SortableHead field="totalOrders" align="right">
                        Buyurtmalar
                      </SortableHead>
                      <TableHead className="text-right">Amal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-caption font-semibold text-muted"
                              aria-hidden="true"
                            >
                              {user.firstName?.charAt(0) || '?'}
                            </div>
                            <span className="font-medium text-ink">
                              {getFullName(user.firstName || '', user.lastName || '')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-caption text-muted">
                          {formatPhone(user.phone)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {USER_ROLE_LABELS[user.role as UserRole] ?? user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <Badge variant={user.status === 'active' ? 'success' : 'destructive'} dot>
                              {user.status === 'active' ? 'Faol' : 'Bloklangan'}
                            </Badge>
                            {user.status === 'blocked' && user.blockReason && (
                              <span
                                className="max-w-[180px] truncate text-caption text-subtle"
                                title={user.blockReason}
                              >
                                {user.blockReason}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-caption tabular-nums text-muted">
                          {formatDate(user.createdAt, 'dd.MM.yyyy')}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-ink">
                          {user.totalOrders ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.status === 'active' ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setBlockTarget(user)}
                              leftIcon={<ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />}
                            >
                              Bloklash
                            </Button>
                          ) : (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleUnblock(user)}
                              leftIcon={<Shield className="h-3.5 w-3.5" aria-hidden="true" />}
                            >
                              Blokdan chiqarish
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        <PaginationBar
          page={pagination.page}
          limit={pagination.limit}
          total={pagination.total}
          totalPages={pagination.totalPages}
          pageRange={pagination.pageRange}
          canGoPrev={pagination.canGoPrev}
          canGoNext={pagination.canGoNext}
          onPageChange={pagination.goToPage}
          onLimitChange={pagination.setLimit}
        />
      </div>

      {/* Bloklash — OG'IR OQIBATLI amal: modal oqibatni aniq aytadi. */}
      <Dialog
        open={!!blockTarget}
        onOpenChange={(open) => {
          if (!open) { setBlockTarget(null); setBlockReason(''); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Foydalanuvchini bloklash</DialogTitle>
            <DialogDescription>
              <strong>
                {getFullName(blockTarget?.firstName || '', blockTarget?.lastName || '')}
              </strong>{' '}
              bloklanadi: tizimga kira olmaydi va yangi buyurtma bera olmaydi.
              Keyin istalgan payt blokdan chiqarish mumkin.
            </DialogDescription>
          </DialogHeader>
          <Input
            label="Sabab (ixtiyoriy)"
            placeholder="Masalan: qoidabuzarlik, spam..."
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setBlockTarget(null); setBlockReason(''); }}>
              Bekor qilish
            </Button>
            <Button
              variant="destructive"
              isLoading={actionLoading}
              onClick={handleBlock}
              leftIcon={<ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Bloklash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
