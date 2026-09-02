'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { formatCurrency } from '@/lib/utils';

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
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const [p, d] = await Promise.all([moderationApi.getProducts(), moderationApi.getDishes()]);
      // API tartibi saqlanadi — javobda vaqt belgisi yo'q, shuning uchun
      // "eng eskisi birinchi" tartibini mijoz tomonida qura olmaymiz.
      setProducts(p.data.data);
      setDishes(d.data.data);
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      setError("Moderatsiya navbatini yuklashda xatolik");
      toast({ title: 'Xatolik', description: "Moderatsiya navbatini yuklashda xatolik", variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = search.trim().toLowerCase();
  const filteredProducts = useMemo(
    () =>
      q
        ? products.filter((p) => [p.name, p.store?.name ?? ''].join(' ').toLowerCase().includes(q))
        : products,
    [products, q]
  );
  const filteredDishes = useMemo(
    () =>
      q
        ? dishes.filter((d) => [d.name, d.restaurant?.name ?? ''].join(' ').toLowerCase().includes(q))
        : dishes,
    [dishes, q]
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'products') {
        await moderationApi.deleteProduct(deleteTarget.id);
        setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      } else {
        await moderationApi.deleteDish(deleteTarget.id);
        setDishes((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      }
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
            <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
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
        {filteredProducts.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium text-ink">{p.name}</TableCell>
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
        {filteredDishes.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="font-medium text-ink">{d.name}</TableCell>
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

  const activeRows = tab === 'products' ? filteredProducts : filteredDishes;

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
              { value: 'products', label: 'Mahsulotlar', count: products.length },
              { value: 'dishes', label: 'Taomlar', count: dishes.length },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
          <div className="min-w-[220px] flex-1">
            <Input
              placeholder="Nomi yoki sotuvchi bo'yicha qidirish..."
              leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
