'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, ShieldOff, Shield, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
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
import { formatDate, formatPhone, getFullName, debounce } from '@/lib/utils';
import { USER_ROLE_LABELS, UserRole } from '@/lib/constants';

export default function UsersPage() {
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<string>('all');
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
      setError("Foydalanuvchilarni yuklab bo'lmadi.");
      toast({ title: 'Xatolik', description: 'Foydalanuvchilarni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, search, role]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
      pagination.reset();
    }, 400),
    []
  );

  const handleToggleBlock = async () => {
    if (!confirmUser) return;
    setActionLoading(true);
    try {
      if (confirmUser.status === 'active') {
        await usersApi.block(confirmUser.id, blockReason.trim() || undefined);
        toast({ title: 'Foydalanuvchi bloklandi', variant: 'success' });
      } else {
        await usersApi.unblock(confirmUser.id);
        toast({ title: 'Foydalanuvchi blokdan chiqarildi', variant: 'success' });
      }
      setConfirmUser(null);
      setBlockReason('');
      await fetchUsers();
    } catch {
      toast({ title: 'Xatolik', description: 'Amalni bajarishda xatolik', variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Foydalanuvchilar"
        description={`Jami: ${pagination.total.toLocaleString()} ta`}
        icon={<UsersIcon className="h-4 w-4" />}
      />
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              placeholder="Telefon, ism yoki familiya bo'yicha qidirish..."
              leftIcon={<Search className="h-4 w-4" />}
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
          <Select value={role} onValueChange={(v) => { setRole(v); pagination.reset(); }}>
            <SelectTrigger className="w-48">
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

        <Card>
          <CardContent className="p-0">
            {error ? (
              <ErrorState message={error} onRetry={fetchUsers} />
            ) : isLoading ? (
              <div className="p-4">
                <SkeletonTable rows={10} cols={7} />
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                icon={<UsersIcon className="h-6 w-6" />}
                title="Foydalanuvchilar topilmadi"
                description="Filtrlarni o'zgartirib qayta urinib ko'ring."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Foydalanuvchi</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead>Ro&apos;yxatdan o&apos;tgan</TableHead>
                    <TableHead>Buyurtmalar</TableHead>
                    <TableHead className="text-right">Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
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
                      <TableCell className="text-muted">
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
                      <TableCell className="text-caption text-muted">
                        {formatDate(user.createdAt, 'dd.MM.yyyy')}
                      </TableCell>
                      <TableCell className="font-medium text-ink">
                        {user.totalOrders ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={user.status === 'active' ? 'destructive' : 'success'}
                          size="sm"
                          onClick={() => setConfirmUser(user)}
                        >
                          {user.status === 'active' ? (
                            <>
                              <ShieldOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                              Bloklash
                            </>
                          ) : (
                            <>
                              <Shield className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                              Blokdan chiqarish
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {!error && !isLoading && users.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-body text-subtle">
              {pagination.total} ta natijadan{' '}
              {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} ko&apos;rsatilmoqda
            </p>
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              pageRange={pagination.pageRange}
              canGoPrev={pagination.canGoPrev}
              canGoNext={pagination.canGoNext}
              onPageChange={pagination.goToPage}
            />
          </div>
        )}
      </div>

      {/* Confirm modal */}
      <Dialog open={!!confirmUser} onOpenChange={() => { setConfirmUser(null); setBlockReason(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmUser?.status === 'active' ? 'Foydalanuvchini bloklash' : 'Blokdan chiqarish'}
            </DialogTitle>
            <DialogDescription>
              {confirmUser?.status === 'active'
                ? `${getFullName(confirmUser?.firstName || '', confirmUser?.lastName || '')} ni bloklamoqchimisiz? U tizimga kira olmaydi.`
                : `${getFullName(confirmUser?.firstName || '', confirmUser?.lastName || '')} ni blokdan chiqarmoqchimisiz?`}
            </DialogDescription>
          </DialogHeader>
          {confirmUser?.status === 'active' && (
            <Input
              label="Sabab (ixtiyoriy)"
              placeholder="Masalan: qoidabuzarlik, spam..."
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmUser(null); setBlockReason(''); }}>
              Bekor qilish
            </Button>
            <Button
              variant={confirmUser?.status === 'active' ? 'destructive' : 'success'}
              isLoading={actionLoading}
              onClick={handleToggleBlock}
            >
              Tasdiqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
