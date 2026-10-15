'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Store, UtensilsCrossed } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable, type DataTableColumn, type SortState } from '@/components/ui/DataTable';
import type { FilterChip } from '@/components/ui/FilterChips';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { usePagination } from '@/hooks/usePagination';
import { downloadCsv } from '@/lib/csv';
import { formatDate } from '@/lib/utils';
import { formatDateShort, formatPhone, fullName } from '@/lib/format';
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
type StatusFilter = 'all' | 'active' | 'closed';

const STATUS_LABELS: Record<Vendor['status'], string> = {
  active: 'Faol',
  closed: 'Yopiq',
};

const STATUS_ITEMS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Hammasi' },
  { value: 'active', label: 'Faol' },
  { value: 'closed', label: 'Yopiq' },
];

function ownerName(v: Vendor): string {
  return fullName(v.owner.firstName, v.owner.lastName, '—');
}

export default function VendorsPage() {
  const { toast } = useToast();
  const pagination = usePagination(20);
  const [tab, setTab] = useState<Tab>('stores');
  const [stores, setStores] = useState<StoreVendor[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  // Cheap client-side filter — live search is fine here.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortState | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [s, r] = await Promise.all([marketAdminApi.getAll(), foodAdminApi.getAll()]);
      setStores(s.data.data);
      setRestaurants(r.data.data);
      setError(null);
    } catch {
      // Last good rows stay on screen; DataTable shows banner + retry.
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
        [v.name, ownerName(v), v.owner.phone, v.address ?? ''].join(' ').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      rows = rows.filter((v) => v.status === statusFilter);
    }
    if (sort) {
      const dir = sort.direction === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        switch (sort.key) {
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
  }, [allRows, search, statusFilter, sort]);

  // Client-side pagination — an admin table never scrolls infinitely.
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pagination.limit));
  useEffect(() => {
    pagination.setTotal(total, totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, totalPages]);
  const safePage = Math.min(pagination.page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * pagination.limit, safePage * pagination.limit);

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
      onRemove: () => {
        setSearch('');
        pagination.reset();
      },
    });
  }
  if (statusFilter !== 'all') {
    chips.push({
      key: 'status',
      label: `Holat: ${STATUS_LABELS[statusFilter]}`,
      onRemove: () => {
        setStatusFilter('all');
        pagination.reset();
      },
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

  const addLabel = tab === 'stores' ? "Yangi do'kon" : 'Yangi restoran';

  const columns: DataTableColumn<Vendor>[] = [
    {
      key: 'name',
      header: 'Nomi',
      sortable: true,
      cell: (v) => <span className="font-medium text-ink">{v.name}</span>,
    },
    {
      key: 'owner',
      header: 'Egasi',
      cell: (v) => (
        <div className="min-w-0 leading-tight">
          <p className="text-ink truncate">{ownerName(v)}</p>
          <p className="num text-xs text-muted whitespace-nowrap">{formatPhone(v.owner.phone)}</p>
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Manzil',
      hideBelow: 'lg',
      className: 'max-w-[240px]',
      cell: (v) => (
        <p className="truncate text-muted" title={v.address ?? undefined}>
          {v.address ?? '—'}
        </p>
      ),
    },
    {
      key: 'status',
      header: 'Holat',
      sortable: true,
      cell: (v) => (
        <Badge variant={v.status === 'active' ? 'success' : 'neutral'} dot>
          {STATUS_LABELS[v.status]}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: "Qo'shilgan",
      sortable: true,
      hideBelow: 'md',
      cell: (v) => <span className="num text-muted whitespace-nowrap">{formatDateShort(v.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amal</span>,
      align: 'right',
      cell: (v) => (
        <Button
          variant={v.status === 'active' ? 'secondary' : 'primary'}
          size="sm"
          isLoading={togglingId === v.id}
          onClick={() => toggleStatus(v)}
        >
          {v.status === 'active' ? 'Yopish' : 'Ochish'}
        </Button>
      ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Sotuvchilar"
        description="Market do'konlari va restoranlarni boshqarish"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
              leftIcon={<Download size={14} aria-hidden />}
            >
              CSV eksport
            </Button>
            <Button leftIcon={<Plus size={14} aria-hidden />} onClick={() => setShowAdd(true)}>
              {addLabel}
            </Button>
          </>
        }
      />

      <Tabs
        ariaLabel="Sotuvchi turi"
        className="mb-4"
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

      <DataTable
        ariaLabel={tab === 'stores' ? "Do'konlar" : 'Restoranlar'}
        columns={columns}
        rows={pagedRows}
        rowKey={(v) => v.id}
        loading={isLoading}
        error={error}
        onRetry={load}
        sort={sort}
        onSortChange={setSort}
        maxHeightClassName="max-h-[calc(100vh-300px)]"
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              pagination.reset();
            }}
            searchPlaceholder="Nomi, egasi, telefon yoki manzil…"
            searchAriaLabel="Sotuvchilarni qidirish"
            chips={chips}
            onClearAll={clearAllFilters}
          >
            <SegmentedControl
              ariaLabel="Holat bo'yicha filtr"
              items={STATUS_ITEMS}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v as StatusFilter);
                pagination.reset();
              }}
            />
          </FilterBar>
        }
        isFiltered={hasActiveFilters}
        onClearFilters={clearAllFilters}
        emptyFiltered={{ title: 'Hech narsa mos kelmadi', description: `Tanlangan filtrlar bo'yicha ${tab === 'stores' ? "do'kon" : 'restoran'} topilmadi.` }}
        empty={{
          variant: 'first-use',
          icon: tab === 'stores' ? <Store aria-hidden /> : <UtensilsCrossed aria-hidden />,
          title: tab === 'stores' ? "Hali do'kon yo'q" : "Hali restoran yo'q",
          description: "Birinchi sotuvchini qo'shing — u darhol o'z panelida ishlay boshlaydi.",
          action: (
            <Button size="sm" leftIcon={<Plus size={14} aria-hidden />} onClick={() => setShowAdd(true)}>
              {addLabel}
            </Button>
          ),
        }}
        pagination={{
          page: safePage,
          limit: pagination.limit,
          total,
          totalPages,
          canGoPrev: safePage > 1,
          canGoNext: safePage < totalPages,
          onPageChange: pagination.goToPage,
          onLimitChange: pagination.setLimit,
        }}
      />

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
    <Modal
      isOpen={open}
      onClose={onClose}
      size="lg"
      title={kind === 'stores' ? "Yangi do'kon qo'shish" : "Yangi restoran qo'shish"}
      description="Sotuvchi darhol o'z panelida ishlay boshlaydi."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Bekor qilish
          </Button>
          <Button onClick={save} isLoading={saving}>
            Saqlash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Input
          label="Egasi telefon raqami"
          placeholder="+998901234599"
          type="tel"
          className="num"
          value={phone}
          error={fieldErrors.phone}
          onChange={(e) => setPhone(e.target.value)}
          required
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
          required
        />
        <Input label="Manzil" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input
          label="Kontakt telefon"
          hint="Ixtiyoriy — egasinikidan farqli bo'lsa"
          type="tel"
          className="num"
          value={vendorPhone}
          onChange={(e) => setVendorPhone(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Lat (kenglik)"
            placeholder="40.0956"
            inputMode="decimal"
            className="num"
            value={lat}
            error={fieldErrors.lat}
            onChange={(e) => setLat(e.target.value)}
          />
          <Input
            label="Lng (uzunlik)"
            placeholder="70.9432"
            inputMode="decimal"
            className="num"
            value={lng}
            error={fieldErrors.lng}
            onChange={(e) => setLng(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted">
          Koordinatalar kuryer yuborish uchun kerak — hozir qoldirilsa, keyinroq sotuvchi o&apos;zi
          Sozlamalar bo&apos;limidan kiritishi mumkin.
        </p>
      </div>
    </Modal>
  );
}
