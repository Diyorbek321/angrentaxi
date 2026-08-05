'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { withdrawalsApi, WithdrawalRequest, WithdrawalStatus } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate, formatPhone, getFullName } from '@/lib/utils';

const statusBadgeVariant: Record<WithdrawalStatus, 'warning' | 'info' | 'destructive' | 'success'> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'destructive',
  paid: 'success',
};

const statusLabel: Record<WithdrawalStatus, string> = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
  paid: "To'langan",
};

const ownerTypeLabel: Record<string, string> = {
  driver: 'Driver',
  vendor: 'Market vendor',
  restaurant: 'Eats restaurant',
};

type Action = 'approved' | 'rejected' | 'paid';

export default function WithdrawalsPage() {
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [target, setTarget] = useState<WithdrawalRequest | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await withdrawalsApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter === 'all' ? undefined : (statusFilter as WithdrawalStatus),
      });
      const payload = res.data.data;
      setWithdrawals(payload?.withdrawals ?? []);
      const total = payload?.total ?? 0;
      pagination.setTotal(total, Math.ceil(total / pagination.limit));
      setError(null);
    } catch {
      setError("Pul yechish so'rovlarini yuklab bo'lmadi.");
      toast({ title: 'Xatolik', description: "Pul yechish so'rovlarini yuklashda xatolik", variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, statusFilter]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const openAction = (withdrawal: WithdrawalRequest, next: Action) => {
    setTarget(withdrawal);
    setAction(next);
    setAdminNote('');
  };

  const closeAction = () => {
    setTarget(null);
    setAction(null);
    setAdminNote('');
  };

  const handleConfirm = async () => {
    if (!target || !action) return;
    setActionLoading(true);
    try {
      await withdrawalsApi.process(target.id, action, adminNote.trim() || undefined);
      toast({ title: "So'rov yangilandi", variant: 'success' });
      closeAction();
      fetchWithdrawals();
    } catch {
      toast({ title: 'Xatolik', description: 'Amalni bajarishda xatolik', variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Tasdiqlash — asosiy interaktiv harakat (yashil, oq matn).
  // Rad etish — xavfli/bekor qiluvchi harakat.
  // "To'landi" deb belgilash — pul tizim tashqarisida qo'lda o'tkazilgani
  // uchun qo'lda aralashuv (amber, `override`).
  const confirmButtonVariant = action === 'rejected' ? 'destructive' : action === 'paid' ? 'override' : 'default';

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Pul yechish so'rovlari"
        description="Haydovchi, Market va Eats — barcha to'lov so'rovlari bitta navbatda"
        icon={<Wallet className="h-4 w-4" />}
      />
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v); pagination.reset(); }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Holat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Kutilmoqda</SelectItem>
              <SelectItem value="approved">Tasdiqlangan</SelectItem>
              <SelectItem value="paid">To&apos;langan</SelectItem>
              <SelectItem value="rejected">Rad etilgan</SelectItem>
              <SelectItem value="all">Barchasi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {error ? (
              <ErrorState message={error} onRetry={fetchWithdrawals} />
            ) : isLoading ? (
              <div className="p-4">
                <SkeletonTable rows={6} cols={7} />
              </div>
            ) : withdrawals.length === 0 ? (
              <EmptyState
                compact
                icon={<Wallet className="h-5 w-5" />}
                title="So'rovlar topilmadi"
                description="Tanlangan holat bo'yicha pul yechish so'rovi yo'q."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>So&apos;rov beruvchi</TableHead>
                    <TableHead>Turi</TableHead>
                    <TableHead>Summa</TableHead>
                    <TableHead>To&apos;lov manzili</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead>Sana</TableHead>
                    <TableHead>Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <p className="font-medium text-ink">
                          {getFullName(w.driver?.firstName ?? '', w.driver?.lastName ?? '') || '—'}
                        </p>
                        <p className="text-caption text-subtle">{w.driver ? formatPhone(w.driver.phone) : '—'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{ownerTypeLabel[w.ownerType] ?? w.ownerType}</Badge>
                      </TableCell>
                      <TableCell className="font-mono font-semibold tabular-nums text-ink">
                        {formatCurrency(w.amount)}
                      </TableCell>
                      <TableCell className="font-mono text-caption text-muted">
                        {w.payoutDestination}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[w.status]} dot>
                          {statusLabel[w.status]}
                        </Badge>
                        {w.adminNote && (
                          <p className="mt-1 max-w-[200px] truncate text-caption text-subtle" title={w.adminNote}>
                            {w.adminNote}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-caption text-muted">{formatDate(w.requestedAt)}</TableCell>
                      <TableCell>
                        {w.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="default" onClick={() => openAction(w, 'approved')}>
                              Tasdiqlash
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => openAction(w, 'rejected')}>
                              Rad etish
                            </Button>
                          </div>
                        )}
                        {w.status === 'approved' && (
                          <Button size="sm" variant="override" onClick={() => openAction(w, 'paid')}>
                            To&apos;landi deb belgilash
                          </Button>
                        )}
                        {(w.status === 'paid' || w.status === 'rejected') && (
                          <span className="text-caption text-subtle" aria-hidden="true">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {!error && !isLoading && withdrawals.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-body text-subtle">
              {pagination.total} ta natijadan{' '}
              {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}–
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

      <Dialog open={!!action} onOpenChange={closeAction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approved' && "So'rovni tasdiqlash"}
              {action === 'rejected' && "So'rovni rad etish"}
              {action === 'paid' && "To'langan deb belgilash"}
            </DialogTitle>
            <DialogDescription>
              {action === 'approved' &&
                "So'rov tasdiqlanadi. Pul haligacha o'tkazilmagan — buni haqiqatda o'tkazgach, \"To'langan\" deb belgilang."}
              {action === 'rejected' &&
                "So'rov rad etiladi va ushlab turilgan summa hamyonga qaytariladi."}
              {action === 'paid' &&
                "Faqat pulni haqiqatda (karta/bank orqali) o'tkazgandan keyin bosing — bu yerda avtomatik to'lov yo'q."}
            </DialogDescription>
          </DialogHeader>
          {target && (
            <div className="rounded-ds-md bg-surface-2 p-3 text-body">
              <p className="text-muted">
                {getFullName(target.driver?.firstName ?? '', target.driver?.lastName ?? '')} —{' '}
                <span className="font-mono tabular-nums text-ink">{formatCurrency(target.amount)}</span>
              </p>
              <p className="mt-1 font-mono text-caption text-subtle">{target.payoutDestination}</p>
            </div>
          )}
          <Input
            label="Izoh (ixtiyoriy)"
            placeholder={action === 'rejected' ? 'Rad etish sababi...' : "Masalan: Click orqali o'tkazildi"}
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeAction}>
              Bekor qilish
            </Button>
            <Button
              variant={confirmButtonVariant}
              isLoading={actionLoading}
              onClick={handleConfirm}
            >
              Tasdiqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
