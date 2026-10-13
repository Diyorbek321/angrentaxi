'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Search, SearchX, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/Table';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { moderationApi, ModeratedProduct, ModeratedDish } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { debounce, formatCurrency } from '@/lib/utils';
import { usePagination } from '@/hooks/usePagination';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { CatalogThumb } from '@/components/moderation/CatalogThumb';

type Tab = 'products' | 'dishes';

interface DeleteTarget {
  kind: Tab;
  id: string;
  name: string;
  vendor: string;
}

export default function ModerationPage() {
  const { toast } = useToast();
  // Tab tartibi: ko'proq ishlatiladigani birinchi (mahsulotlar navbati kattaroq).
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<ModeratedProduct[]>([]);
  const [dishes, setDishes] = useState<ModeratedDish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  /** Input'dagi matn (darhol) va so'rovga ketgan matn (400 ms dan keyin). */
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [totals, setTotals] = useState<Record<Tab, number>>({ products: 0, dishes: 0 });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pagination = usePagination(20);
  const { page, limit, setTotal, reset: resetPage } = pagination;

  // Server sahifalaydi va qidiradi: katalog o'sgani sari hammasini bir
  // so'rovda olib, brauzerda filtrlash sekinlashib borardi.
  const load = useCallback(async () => {
    setIsLoading(true);
    const params = { page, limit, search: search.trim() || undefined };
    try {
      if (tab === 'products') {
        const res = (await moderationApi.getProducts(params)).data.data;
        setProducts(res.products);
        setTotals((t) => ({ ...t, products: res.total }));
        setTotal(res.total, Math.max(1, Math.ceil(res.total / res.limit)));
      } else {
        const res = (await moderationApi.getDishes(params)).data.data;
        setDishes(res.dishes);
        setTotals((t) => ({ ...t, dishes: res.total }));
        setTotal(res.total, Math.max(1, Math.ceil(res.total / res.limit)));
      }
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      setError("Moderatsiya navbatini yuklashda xatolik");
      toast({ title: 'Xatolik', description: "Moderatsiya navbatini yuklashda xatolik", variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [tab, page, limit, search, setTotal, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ikkinchi tabning soni ham ko'rinsin — bitta yozuvli yengil so'rov.
  useEffect(() => {
    void Promise.all([
      moderationApi.getProducts({ page: 1, limit: 1 }),
      moderationApi.getDishes({ page: 1, limit: 1 }),
    ])
      .then(([p, d]) => setTotals({ products: p.data.data.total, dishes: d.data.data.total }))
      .catch(() => {});
  }, []);

  const debouncedSearch = useRef(
    debounce((value: string) => {
      setSearch(value);
      resetPage();
    }, 400)
  ).current;

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedSearch(value);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    resetPage();
  };

  const q = search.trim();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'products') {
        await moderationApi.deleteProduct(deleteTarget.id);
      } else {
        await moderationApi.deleteDish(deleteTarget.id);
      }
      // Sahifa server bo'yicha qayta to'ladi: keyingi sahifadagi yozuv o'rniga chiqadi.
      await load();
      toast({
        title: `«${deleteTarget.name}» o'chirildi`,
        description: 'Sotuvchi katalogidan butunlay olib tashlandi.',
        variant: 'success',
      });
      setDeleteTarget(null);
    } catch {
      toast({ title: 'Xatolik', description: "O'chirishda xatolik", variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const showFullError = error && !isLoading && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && hasLoadedOnce;

  const renderEmpty = (kind: Tab) => {
    if (q) {
      return (
        <EmptyState
          compact
          icon={<SearchX className="h-5 w-5" />}
          title="Hech narsa mos kelmadi"
          description={`"${search.trim()}" bo'yicha ${kind === 'products' ? 'mahsulot' : 'taom'} topilmadi.`}
          action={
            <Button variant="secondary" size="sm" onClick={clearSearch}>
              Qidiruvni tozalash
            </Button>
          }
        />
      );
    }
    // Bo'sh navbat — SOG'LOM holat: hech narsa "buzilgan" degan ma'no bermasin.
    return (
      <EmptyState
        tone="positive"
        icon={<CheckCircle2 className="h-6 w-6" />}
        title="Navbat bo'sh ✓"
        description={
          kind === 'products'
            ? "Ko'rib chiqilishi kerak bo'lgan mahsulot qolmadi."
            : "Ko'rib chiqilishi kerak bo'lgan taom qolmadi."
        }
      />
    );
  };

  const renderProductRows = () => (
    <Table stickyHeader containerClassName="max-h-[65vh]">
      <TableHeader>
        <TableRow>
          <TableHead>Mahsulot</TableHead>
          <TableHead>Do&apos;kon</TableHead>
          <TableHead className="text-right">Narx</TableHead>
          <TableHead>Holat</TableHead>
          <TableHead className="text-right">Amal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium text-ink">
              <div className="flex items-center gap-3">
                <CatalogThumb imageKey={p.imageKey} name={p.name} />
                <span>{p.name}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted">{p.store?.name ?? '—'}</TableCell>
            <TableCell className="text-right font-mono tabular-nums text-ink">
              {formatCurrency(p.price)}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{p.status}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="destructive"
                leftIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() =>
                  setDeleteTarget({ kind: 'products', id: p.id, name: p.name, vendor: p.store?.name ?? '—' })
                }
              >
                O&apos;chirish
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderDishRows = () => (
    <Table stickyHeader containerClassName="max-h-[65vh]">
      <TableHeader>
        <TableRow>
          <TableHead>Taom</TableHead>
          <TableHead>Restoran</TableHead>
          <TableHead className="text-right">Narx</TableHead>
          <TableHead>Holat</TableHead>
          <TableHead className="text-right">Amal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dishes.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="font-medium text-ink">
              <div className="flex items-center gap-3">
                <CatalogThumb imageKey={d.imageKey} name={d.name} />
                <span>{d.name}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted">{d.restaurant?.name ?? '—'}</TableCell>
            <TableCell className="text-right font-mono tabular-nums text-ink">
              {formatCurrency(d.price)}
            </TableCell>
            <TableCell>
              <Badge variant={d.isAvailable ? 'success' : 'secondary'} dot>
                {d.isAvailable ? 'Mavjud' : 'Tugagan'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="destructive"
                leftIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() =>
                  setDeleteTarget({ kind: 'dishes', id: d.id, name: d.name, vendor: d.restaurant?.name ?? '—' })
                }
              >
                O&apos;chirish
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const activeRows = tab === 'products' ? products : dishes;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Mahsulot/Menyu moderatsiyasi"
        description="Barcha do'kon va restoranlar bo'yicha mahsulot/taomlarni ko'rib chiqish"
        icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Tabs
            ariaLabel="Moderatsiya turi"
            items={[
              { value: 'products', label: 'Mahsulotlar', count: totals.products },
              { value: 'dishes', label: 'Taomlar', count: totals.dishes },
            ]}
            value={tab}
            onChange={(v) => {
              setTab(v as Tab);
              resetPage();
            }}
          />
          <div className="min-w-[220px] flex-1">
            <Input
              placeholder="Nomi yoki sotuvchi bo'yicha qidirish..."
              leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-label="Moderatsiya navbatida qidirish"
            />
          </div>
        </div>

        {showErrorBanner && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-4 py-3"
          >
            <p className="flex items-center gap-2 text-body text-danger-deep dark:text-danger-light">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error} — oxirgi muvaffaqiyatli yuklangan ma&apos;lumot ko&apos;rsatilmoqda.
            </p>
            <Button variant="secondary" size="sm" onClick={load}>
              Qayta urinish
            </Button>
          </div>
        )}

        {showFullError ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState message={error} onRetry={load} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {isLoading && !hasLoadedOnce ? (
                <SkeletonTable rows={6} cols={5} className="border-0" />
              ) : activeRows.length === 0 ? (
                renderEmpty(tab)
              ) : tab === 'products' ? (
                renderProductRows()
              ) : (
                renderDishRows()
              )}
            </CardContent>
          </Card>
        )}

        {pagination.total > 0 && (
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
        )}
      </div>

      {/* O'chirish — DESTRUKTIV amal, shuning uchun tasdiqlash modali shart.
          Oqibat aniq so'z bilan aytiladi va nom qayta ko'rsatiladi. */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.kind === 'products' ? "Mahsulotni o'chirish" : "Taomni o'chirish"}
            </DialogTitle>
            <DialogDescription>
              <strong>«{deleteTarget?.name}»</strong> ({deleteTarget?.vendor}) katalogdan butunlay
              o&apos;chiriladi va mijozlarga ko&apos;rinmay qoladi. Bu amalni ortga qaytarib
              bo&apos;lmaydi — sotuvchi uni qaytadan yaratishi kerak bo&apos;ladi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Bekor qilish
            </Button>
            <Button
              variant="destructive"
              isLoading={deleting}
              onClick={handleDelete}
              leftIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              O&apos;chirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
