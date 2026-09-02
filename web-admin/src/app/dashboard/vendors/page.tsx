'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Plus,
  Search,
  SearchX,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Card, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/Table';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChips, type FilterChip } from '@/components/ui/FilterChips';
import { PaginationBar } from '@/components/ui/PaginationBar';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { usePagination } from '@/hooks/usePagination';
import { downloadCsv } from '@/lib/csv';
import { cn, formatDate, formatPhone } from '@/lib/utils';
import {
  marketAdminApi,
  foodAdminApi,
  StoreVendor,
  RestaurantVendor,
  CreateStoreVendorInput,
  CreateRestaurantVendorInput,
} from '@/lib/api';

type Tab = 'stores' | 'restaurants';
type Vendor = StoreVendor | RestaurantVendor;
type SortDir = 'asc' | 'desc' | null;

const STATUS_LABELS: Record<Vendor['status'], string> = {
  active: 'Faol',
  closed: 'Yopiq',
};

function ownerName(v: Vendor): string {
  return [v.owner.firstName, v.owner.lastName].filter(Boolean).join(' ') || '—';
}

export default function VendorsPage() {
  const { toast } = useToast();
  const pagination = usePagination(20);
  // Tab tartibi: eng ko'p ishlatiladigani birinchi (do'konlar). Tanlangan tab
  // Tabs primitivida IKKI vizual belgi oladi: to'ldirilgan yuza + chegara.
  const [tab, setTab] = useState<Tab>('stores');
  const [stores, setStores] = useState<StoreVendor[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  // Mijoz tomonidagi arzon filtr — jonli qidiruv mumkin (data-tables doktrina).
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [s, r] = await Promise.all([marketAdminApi.getAll(), foodAdminApi.getAll()]);
      setStores(s.data.data);
      setRestaurants(r.data.data);
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      // Oxirgi muvaffaqiyatli qatorlar ekranda QOLADI; banner + retry chiqadi.
      setError('Sotuvchilarni yuklashda xatolik');
      toast({ title: 'Xatolik', description: 'Sotuvchilarni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allRows: Vendor[] = tab === 'stores' ? stores : restaurants;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = allRows;
    if (q) {
      rows = rows.filter((v) =>
        [v.name, ownerName(v), v.owner.phone, v.address ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    if (statusFilter !== 'all') {
      rows = rows.filter((v) => v.status === statusFilter);
    }
    if (sortField && sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        switch (sortField) {
          case 'name':
            return a.name.localeCompare(b.name) * dir;
          case 'status':
            return a.status.localeCompare(b.status) * dir;
          case 'createdAt':
            return a.createdAt.localeCompare(b.createdAt) * dir;
          default:
            return 0;
        }
      });
    }
    return rows;
  }, [allRows, search, statusFilter, sortField, sortDir]);

  // Mijoz tomonidagi sahifalash — admin jadvali cheksiz aylantirilmaydi.
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

  const toggleStatus = async (v: Vendor) => {
    const next = v.status === 'active' ? 'closed' : 'active';
    setTogglingId(v.id);
    try {
      if (tab === 'stores') {
        await marketAdminApi.setStatus(v.id, next);
        setStores((prev) => prev.map((s) => (s.id === v.id ? { ...s, status: next } : s)));
      } else {
        await foodAdminApi.setStatus(v.id, next);
        setRestaurants((prev) => prev.map((r) => (r.id === v.id ? { ...r, status: next } : r)));
      }
      toast({
        title: next === 'closed' ? `«${v.name}» yopildi` : `«${v.name}» ochildi`,
        description:
          next === 'closed'
            ? "Mijozlar ilovasida ko'rinmaydi va yangi buyurtma qabul qilmaydi."
            : 'Mijozlar ilovasida yana buyurtma qabul qiladi.',
        variant: 'success',
      });
    } catch {
      toast({ title: 'Xatolik', description: "Holatni o'zgartirib bo'lmadi", variant: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) return;
    downloadCsv<Vendor>(
      `${tab === 'stores' ? 'dokonlar' : 'restoranlar'}-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'Nomi', value: (v) => v.name },
        { header: 'Egasi', value: (v) => ownerName(v) },
        { header: 'Telefon', value: (v) => v.owner.phone },
        { header: 'Manzil', value: (v) => v.address ?? '' },
        { header: 'Holat', value: (v) => STATUS_LABELS[v.status] },
        { header: "Qo'shilgan sana", value: (v) => formatDate(v.createdAt) },
      ],
      filteredRows
    );
    toast({ title: 'CSV yuklab olindi', description: `${filteredRows.length} ta qator`, variant: 'success' });
  };

  const SortableHead = ({ field, children }: { field: string; children: React.ReactNode }) => {
    const active = sortField === field && !!sortDir;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <TableHead aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => handleSort(field)}
          className={cn(
            'inline-flex items-center gap-1 text-micro uppercase transition-colors duration-fast',
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

  const emptyState = hasActiveFilters ? (
    <EmptyState
      icon={<SearchX className="h-6 w-6" />}
      title="Hech narsa mos kelmadi"
      description={`Tanlangan filtrlar bo'yicha ${tab === 'stores' ? "do'kon" : 'restoran'} topilmadi.`}
      action={
        <Button variant="secondary" size="sm" onClick={clearAllFilters}>
          Filtrlarni tozalash
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={tab === 'stores' ? <Store className="h-6 w-6" /> : <UtensilsCrossed className="h-6 w-6" />}
      title={tab === 'stores' ? "Hali do'kon yo'q" : "Hali restoran yo'q"}
      description="Birinchi sotuvchini qo'shish uchun tugmani bosing — u darhol o'z panelida ishlay boshlaydi."
      action={
        <Button leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setShowAdd(true)}>
          {tab === 'stores' ? "Yangi do'kon" : 'Yangi restoran'}
        </Button>
      }
    />
  );

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Sotuvchilar"
        description="Market do'konlari va restoranlarni boshqarish"
        icon={<Store className="h-4 w-4" aria-hidden="true" />}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
              leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              CSV eksport
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setShowAdd(true)}>
              {tab === 'stores' ? "Yangi do'kon" : 'Yangi restoran'}
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <Tabs
            ariaLabel="Sotuvchi turi"
            items={[
              { value: 'stores', label: "Do'konlar", count: stores.length },
              { value: 'restaurants', label: 'Restoranlar', count: restaurants.length },
            ]}
            value={tab}
            onChange={(v) => {
              setTab(v as Tab);
              pagination.reset();
            }}
          />
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <Input
                placeholder="Nomi, egasi, telefon yoki manzil bo'yicha qidirish..."
                leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
                value={search}
                onChange={(e) => { setSearch(e.target.value); pagination.reset(); }}
                aria-label="Sotuvchilarni qidirish"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); pagination.reset(); }}
            >
              <SelectTrigger className="w-40" aria-label="Holat bo'yicha filtr">
                <SelectValue placeholder="Holat" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha holatlar</SelectItem>
                <SelectItem value="active">Faol</SelectItem>
                <SelectItem value="closed">Yopiq</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                <SkeletonTable rows={8} cols={6} className="border-0" />
              ) : pagedRows.length === 0 ? (
                emptyState
              ) : (
                <Table stickyHeader containerClassName="max-h-[65vh]">
                  <TableHeader>
                    <TableRow>
                      <SortableHead field="name">Nomi</SortableHead>
                      <TableHead>Egasi</TableHead>
                      <TableHead>Manzil</TableHead>
                      <SortableHead field="status">Holat</SortableHead>
                      <SortableHead field="createdAt">Qo&apos;shilgan</SortableHead>
                      <TableHead className="text-right">Amal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium text-ink">{v.name}</TableCell>
                        <TableCell>
                          <p className="text-body text-ink">{ownerName(v)}</p>
                          <p className="font-mono text-caption text-muted">{formatPhone(v.owner.phone)}</p>
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <p className="truncate text-body text-muted" title={v.address ?? undefined}>
                            {v.address ?? '—'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={v.status === 'active' ? 'success' : 'secondary'} dot>
                            {STATUS_LABELS[v.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-caption tabular-nums text-muted">
                          {formatDate(v.createdAt, 'dd.MM.yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant={v.status === 'active' ? 'outline' : 'secondary'}
                            size="sm"
                            isLoading={togglingId === v.id}
                            onClick={() => toggleStatus(v)}
                          >
                            {v.status === 'active' ? 'Yopish' : 'Ochish'}
                          </Button>
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

      <AddVendorModal
        kind={tab}
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={async () => {
          setShowAdd(false);
          await load();
        }}
      />
    </div>
  );
}

function AddVendorModal({
  kind,
  open,
  onClose,
  onCreated,
}: {
  kind: Tab;
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [saving, setSaving] = useState(false);
  // Xatolar maydonning O'ZIGA biriktiriladi (toast emas) — forma doktrinasi.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!phone.trim()) errors.phone = 'Telefon raqamini kiriting';
    else if (!/^\+?998\d{9}$/.test(phone.trim().replace(/[\s-]/g, '')))
      errors.phone = "Noto'g'ri format (+998XXXXXXXXX)";
    if (!name.trim()) errors.name = 'Nomini kiriting';
    if (lat && Number.isNaN(Number(lat))) errors.lat = "Raqam bo'lishi kerak";
    if (lng && Number.isNaN(Number(lng))) errors.lng = "Raqam bo'lishi kerak";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (kind === 'stores') {
        const input: CreateStoreVendorInput = {
          phone: phone.trim(),
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          storeName: name.trim(),
          storeAddress: address || undefined,
          storePhone: vendorPhone || undefined,
          lat: lat ? Number(lat) : undefined,
          lng: lng ? Number(lng) : undefined,
        };
        await marketAdminApi.create(input);
      } else {
        const input: CreateRestaurantVendorInput = {
          phone: phone.trim(),
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          restaurantName: name.trim(),
          restaurantAddress: address || undefined,
          restaurantPhone: vendorPhone || undefined,
          lat: lat ? Number(lat) : undefined,
          lng: lng ? Number(lng) : undefined,
        };
        await foodAdminApi.create(input);
      }
      toast({ title: "Sotuvchi qo'shildi", variant: 'success' });
      setPhone(''); setFirstName(''); setLastName(''); setName('');
      setAddress(''); setVendorPhone(''); setLat(''); setLng('');
      setFieldErrors({});
      await onCreated();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Sotuvchi qo'shishda xatolik";
      toast({ title: 'Xatolik', description: message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {kind === 'stores' ? "Yangi do'kon qo'shish" : "Yangi restoran qo'shish"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3.5">
          <Input
            label="Egasi telefon raqami"
            placeholder="+998901234599"
            mono
            value={phone}
            error={fieldErrors.phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ismi" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input label="Familiyasi" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <Input
            label={kind === 'stores' ? "Do'kon nomi" : 'Restoran nomi'}
            value={name}
            error={fieldErrors.name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input label="Manzil" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input
            label="Kontakt telefon (ixtiyoriy, egasinikidan farqli bo'lsa)"
            value={vendorPhone}
            onChange={(e) => setVendorPhone(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Lat (kenglik)"
              placeholder="40.0956"
              mono
              value={lat}
              error={fieldErrors.lat}
              onChange={(e) => setLat(e.target.value)}
            />
            <Input
              label="Lng (uzunlik)"
              placeholder="70.9432"
              mono
              value={lng}
              error={fieldErrors.lng}
              onChange={(e) => setLng(e.target.value)}
            />
          </div>
          <p className="text-caption text-subtle">
            Koordinatalar kuryer yuborish uchun kerak — hozir qoldirilsa, keyinroq sotuvchi o&apos;zi
            Sozlamalar bo&apos;limidan kiritishi mumkin.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button onClick={save} isLoading={saving}>
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
