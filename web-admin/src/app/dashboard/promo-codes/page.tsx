'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Search,
  SearchX,
  Tag,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { FilterChips, type FilterChip } from '@/components/ui/FilterChips';
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
import { SkeletonTable } from '@/components/ui/Skeleton';
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
import { promoCodesApi, PromoCode } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

type SortDir = 'asc' | 'desc' | null;
type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_LABELS: Record<Exclude<StatusFilter, 'all'>, string> = {
  active: 'Faol',
  inactive: 'Faol emas',
};

function discountText(promo: PromoCode): string {
  return promo.discountPercent != null
    ? `${promo.discountPercent}%`
    : formatCurrency(promo.discountFixed ?? 0);
}

export default function PromoCodesPage() {
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<PromoCode | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const fetchPromoCodes = async () => {
    setIsLoading(true);
    try {
      const res = await promoCodesApi.getAll();
      setPromoCodes(res.data.data);
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      // Oxirgi muvaffaqiyatli qatorlar ekranda qoladi; banner + retry chiqadi.
      setError("Promo kodlarni yuklab bo'lmadi");
      toast({ title: 'Xatolik', description: 'Promo kodlarni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromoCodes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = promoCodes;
    if (q) rows = rows.filter((p) => p.code.toLowerCase().includes(q));
    if (statusFilter !== 'all') {
      rows = rows.filter((p) => (statusFilter === 'active' ? p.isActive : !p.isActive));
    }
    if (sortField && sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        switch (sortField) {
          case 'code':
            return a.code.localeCompare(b.code) * dir;
          case 'usedCount':
            return (a.usedCount - b.usedCount) * dir;
          case 'expiresAt':
            return (a.expiresAt ?? '').localeCompare(b.expiresAt ?? '') * dir;
          case 'createdAt':
            return a.createdAt.localeCompare(b.createdAt) * dir;
          default:
            return 0;
        }
      });
    }
    return rows;
  }, [promoCodes, search, statusFilter, sortField, sortDir]);

  // Mijoz tomonidagi sahifalash — API butun ro'yxatni bir marta qaytaradi.
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pagination.limit));
  useEffect(() => {
    pagination.setTotal(total, totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, totalPages]);
  const safePage = Math.min(pagination.page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * pagination.limit, safePage * pagination.limit);

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

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
    pagination.reset();
  };

  const chips: FilterChip[] = [];
  if (search.trim()) {
    chips.push({
      key: 'search',
      label: `Qidiruv: "${search.trim()}"`,
      onRemove: () => { setSearch(''); pagination.reset(); },
    });
  }
  if (statusFilter !== 'all') {
    chips.push({
      key: 'status',
      label: `Holat: ${STATUS_LABELS[statusFilter]}`,
      onRemove: () => { setStatusFilter('all'); pagination.reset(); },
    });
  }
  const hasActiveFilters = chips.length > 0;

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await promoCodesApi.deactivate(deactivateTarget.id);
      setPromoCodes((prev) =>
        prev.map((p) => (p.id === deactivateTarget.id ? { ...p, isActive: false } : p))
      );
      toast({
        title: `«${deactivateTarget.code}» faolsizlantirildi`,
        description: 'Bundan buyon yangi buyurtmalarga qo\'llanilmaydi.',
        variant: 'success',
      });
      setDeactivateTarget(null);
    } catch {
      toast({ title: 'Xatolik', description: "Faolsizlantirishda xatolik", variant: 'error' });
    } finally {
      setDeactivating(false);
    }
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) return;
    downloadCsv<PromoCode>(
      `promo-kodlar-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'Kod', value: (p) => p.code },
        { header: 'Chegirma', value: (p) => discountText(p) },
        { header: 'Ishlatilgan', value: (p) => p.usedCount },
        { header: 'Limit', value: (p) => p.maxUses ?? '' },
        { header: 'Min. summa', value: (p) => p.minOrderAmount },
        { header: 'Muddati', value: (p) => (p.expiresAt ? formatDate(p.expiresAt, 'dd.MM.yyyy') : '') },
        { header: 'Holati', value: (p) => (p.isActive ? 'Faol' : 'Faol emas') },
        { header: 'Yaratilgan', value: (p) => formatDate(p.createdAt) },
      ],
      filteredRows
    );
    toast({ title: 'CSV yuklab olindi', description: `${filteredRows.length} ta qator`, variant: 'success' });
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

  const showFullError = error && !isLoading && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && hasLoadedOnce;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Promo kodlar"
        description={`Jami: ${promoCodes.length.toLocaleString('uz-UZ')} ta`}
        icon={<Tag className="h-4 w-4" aria-hidden="true" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
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
              placeholder="Kod bo'yicha qidirish..."
              leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); pagination.reset(); }}
              aria-label="Promo kodlarni qidirish"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v as StatusFilter); pagination.reset(); }}
          >
            <SelectTrigger className="w-44" aria-label="Holat bo'yicha filtr">
              <SelectValue placeholder="Holat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha holatlar</SelectItem>
              <SelectItem value="active">Faol</SelectItem>
              <SelectItem value="inactive">Faol emas</SelectItem>
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
            <Button variant="secondary" size="sm" onClick={fetchPromoCodes}>
              Qayta urinish
            </Button>
          </div>
        )}

        {showFullError ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState message={error} onRetry={fetchPromoCodes} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {isLoading && !hasLoadedOnce ? (
                <SkeletonTable rows={8} cols={7} className="border-0" />
              ) : pagedRows.length === 0 ? (
                hasActiveFilters ? (
                  <EmptyState
                    icon={<SearchX className="h-6 w-6" />}
                    title="Hech narsa mos kelmadi"
                    description="Tanlangan filtrlar bo'yicha promo kod topilmadi."
                    action={
                      <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                        Filtrlarni tozalash
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<Tag className="h-6 w-6" />}
                    title="Promo kodlar yo'q"
                    description="Chegirma kodlari marketing bo'limida yaratiladi — yaratilgani shu jadvalda ko'rinadi."
                  />
                )
              ) : (
                <Table stickyHeader containerClassName="max-h-[65vh]">
                  <TableHeader>
                    <TableRow>
                      <SortableHead field="code">Kod</SortableHead>
                      <TableHead className="text-right">Chegirma</TableHead>
                      <SortableHead field="usedCount" align="right">
                        Ishlatilgan
                      </SortableHead>
                      <TableHead className="text-right">Min. summa</TableHead>
                      <SortableHead field="expiresAt">Muddati</SortableHead>
                      <TableHead>Holati</TableHead>
                      <TableHead className="text-right">Amal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((promo) => (
                      <TableRow key={promo.id}>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 font-mono font-medium text-ink">
                            <Tag className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
                            {promo.code}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-ink">
                          {discountText(promo)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted">
                          {promo.usedCount}
                          {promo.maxUses != null ? ` / ${promo.maxUses}` : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted">
                          {formatCurrency(promo.minOrderAmount)}
                        </TableCell>
                        <TableCell className="text-caption tabular-nums text-muted">
                          {promo.expiresAt ? formatDate(promo.expiresAt, 'dd.MM.yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={promo.isActive ? 'success' : 'secondary'} dot>
                            {promo.isActive ? 'Faol' : 'Faol emas'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {promo.isActive ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeactivateTarget(promo)}
                            >
                              Faolsizlantirish
                            </Button>
                          ) : (
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

        {!showFullError && (
          <PaginationBar
            page={safePage}
            limit={pagination.limit}
            total={total}
            totalPages={totalPages}
            pageRange={pagination.pageRange}
            canGoPrev={safePage > 1}
            canGoNext={safePage < totalPages}
            onPageChange={pagination.goToPage}
            onLimitChange={pagination.setLimit}
          />
        )}
      </div>

      {/* Faolsizlantirish QAYTARIB BO'LMAYDI — API'da qayta yoqish yo'q,
          shuning uchun bu inline toggle emas, tasdiqlash modali. */}
      <Dialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promo kodni faolsizlantirish</DialogTitle>
            <DialogDescription>
              <strong>{deactivateTarget?.code}</strong> (
              {deactivateTarget ? discountText(deactivateTarget) : ''}) faolsizlantiriladi va
              bundan buyon yangi buyurtmalarga qo&apos;llanilmaydi. Kodni keyin qayta yoqib
              bo&apos;lmaydi — kerak bo&apos;lsa yangi kod yaratiladi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Bekor qilish
            </Button>
            <Button variant="destructive" isLoading={deactivating} onClick={handleDeactivate}>
              Faolsizlantirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
