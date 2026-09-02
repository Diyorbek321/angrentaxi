'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
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
import { downloadCsv } from '@/lib/csv';
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
  driver: 'Haydovchi',
  vendor: 'Market sotuvchi',
  restaurant: 'Restoran',
};

type Action = 'approved' | 'rejected' | 'paid';
type StatusFilter = WithdrawalStatus | 'all';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Kutilmoqda' },
  { value: 'approved', label: 'Tasdiqlangan' },
  { value: 'paid', label: "To'langan" },
  { value: 'rejected', label: 'Rad etilgan' },
  { value: 'all', label: 'Barchasi' },
];

export default function WithdrawalsPage() {
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  // Navbat sahifasi: standart ko'rinish — hal qilinishi KUTILAYOTGANLAR.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
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
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      const payload = res.data.data;
      setWithdrawals(payload?.withdrawals ?? []);
      const total = payload?.total ?? 0;
      pagination.setTotal(total, Math.ceil(total / pagination.limit));
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      // Oxirgi muvaffaqiyatli qatorlar ekranda qoladi; banner + retry chiqadi.
      setError("Pul yechish so'rovlarini yuklab bo'lmadi");
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
      toast({
        title:
          action === 'approved'
            ? "So'rov tasdiqlandi"
            : action === 'rejected'
            ? "So'rov rad etildi — summa hamyonga qaytadi"
            : "To'langan deb belgilandi",
        description: `${formatCurrency(target.amount)} · ${getFullName(
          target.driver?.firstName ?? '',
          target.driver?.lastName ?? ''
        )}`,
        variant: 'success',
      });
      closeAction();
      fetchWithdrawals();
    } catch {
      toast({ title: 'Xatolik', description: 'Amalni bajarishda xatolik', variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (withdrawals.length === 0) return;
    downloadCsv<WithdrawalRequest>(
      `pul-yechish-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        {
          header: "So'rov beruvchi",
          value: (w) => getFullName(w.driver?.firstName ?? '', w.driver?.lastName ?? ''),
        },
        { header: 'Telefon', value: (w) => w.driver?.phone ?? '' },
        { header: 'Turi', value: (w) => ownerTypeLabel[w.ownerType] ?? w.ownerType },
        { header: 'Summa', value: (w) => w.amount },
        { header: "To'lov manzili", value: (w) => w.payoutDestination },
        { header: 'Holat', value: (w) => statusLabel[w.status] },
        { header: "So'ralgan sana", value: (w) => formatDate(w.requestedAt) },
        { header: 'Izoh', value: (w) => w.adminNote ?? '' },
      ],
      withdrawals
    );
    toast({ title: 'CSV yuklab olindi', description: `${withdrawals.length} ta qator`, variant: 'success' });
  };

  // Tasdiqlash — asosiy interaktiv harakat (yashil, oq matn).
  // Rad etish — xavfli/bekor qiluvchi harakat.
  // "To'landi" deb belgilash — pul tizim tashqarisida qo'lda o'tkazilgani
  // uchun qo'lda aralashuv (amber, `override`).
  const confirmButtonVariant =
    action === 'rejected' ? 'destructive' : action === 'paid' ? 'override' : 'default';

  const showFullError = error && !isLoading && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && hasLoadedOnce;

  const renderEmpty = () => {
    if (statusFilter === 'pending') {
      // HAQIQIY "tozalangan navbat" holati — bu yaxshi yangilik, muammo emas.
      return (
        <EmptyState
          tone="positive"
          icon={<CheckCircle2 className="h-6 w-6" />}
          title="Navbat bo'sh ✓"
          description="Barcha pul yechish so'rovlari ko'rib chiqilgan. Yangi so'rov kelganda shu yerda ko'rinadi."
        />
      );
    }
    return (
      <EmptyState
        icon={<Wallet className="h-6 w-6" />}
        title="So'rovlar topilmadi"
        description={`"${STATUS_TABS.find((t) => t.value === statusFilter)?.label}" holatida so'rov yo'q.`}
        action={
          statusFilter !== 'all' ? (
            <Button variant="secondary" size="sm" onClick={() => { setStatusFilter('all'); pagination.reset(); }}>
              Barchasini ko&apos;rish
            </Button>
          ) : undefined
        }
      />
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Pul yechish so'rovlari"
        description="Haydovchi, Market va Eats — barcha to'lov so'rovlari bitta navbatda"
        icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={withdrawals.length === 0}
            leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            CSV eksport
          </Button>
        }
      />
      <div className="space-y-4">
        <Tabs
          ariaLabel="Holat bo'yicha filtr"
          items={STATUS_TABS}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v as StatusFilter); pagination.reset(); }}
        />

        {showErrorBanner && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-4 py-3"
          >
            <p className="flex items-center gap-2 text-body text-danger-deep dark:text-danger-light">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error} — oxirgi muvaffaqiyatli yuklangan ma&apos;lumot ko&apos;rsatilmoqda.
            </p>
            <Button variant="secondary" size="sm" onClick={fetchWithdrawals}>
              Qayta urinish
            </Button>
          </div>
        )}

        {showFullError ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState message={error} onRetry={fetchWithdrawals} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <SkeletonTable rows={6} cols={7} className="border-0" />
              ) : withdrawals.length === 0 ? (
                renderEmpty()
              ) : (
                <Table stickyHeader containerClassName="max-h-[65vh]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>So&apos;rov beruvchi</TableHead>
                      <TableHead>Turi</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>To&apos;lov manzili</TableHead>
                      <TableHead>Holat</TableHead>
                      <TableHead>Sana</TableHead>
                      <TableHead className="text-right">Amallar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>
                          <p className="font-medium text-ink">
                            {getFullName(w.driver?.firstName ?? '', w.driver?.lastName ?? '') || '—'}
                          </p>
                          <p className="font-mono text-caption text-subtle">
                            {w.driver ? formatPhone(w.driver.phone) : '—'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{ownerTypeLabel[w.ownerType] ?? w.ownerType}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums text-ink">
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
                        <TableCell className="text-caption tabular-nums text-muted">
                          {formatDate(w.requestedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {w.status === 'pending' && (
                            <div className="flex justify-end gap-2">
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

      {/* MOLIYAVIY amal — har doim aniq tasdiqlash: summa QAYTA ko'rsatiladi,
          oqibat so'z bilan aytiladi. */}
      <Dialog open={!!action} onOpenChange={(open) => !open && closeAction()}>
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
            <div className="rounded-ds-md bg-surface-2 p-4">
              <p className="text-caption text-muted">
                {getFullName(target.driver?.firstName ?? '', target.driver?.lastName ?? '')} ·{' '}
                {ownerTypeLabel[target.ownerType] ?? target.ownerType}
              </p>
              <p className="mt-1 font-mono text-h2 tabular-nums text-ink">
                {formatCurrency(target.amount)}
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
            <Button variant={confirmButtonVariant} isLoading={actionLoading} onClick={handleConfirm}>
              {action === 'approved' && target
                ? `Tasdiqlash — ${formatCurrency(target.amount)}`
                : action === 'rejected'
                ? 'Rad etish'
                : "To'landi deb belgilash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
