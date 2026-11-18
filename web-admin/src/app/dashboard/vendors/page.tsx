'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Pencil, Plus, Store, UtensilsCrossed } from 'lucide-react';
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
import { VendorTinModal, type VendorTinTarget } from '@/components/vendors/VendorTinModal';
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
import { t } from '@/locales';

type Tab = 'stores' | 'restaurants';
type Vendor = StoreVendor | RestaurantVendor;
type StatusFilter = 'all' | 'active' | 'closed';

function statusItems(): { value: StatusFilter; label: string }[] {
  const v = t().vendors;
  return [
    { value: 'all', label: v.all },
    { value: 'active', label: v.status.active },
    { value: 'closed', label: v.status.closed },
  ];
}

function ownerName(v: Vendor): string {
  return fullName(v.owner.firstName, v.owner.lastName, '—');
}

export default function VendorsPage() {
  const m = t();
  const vm = m.vendors;
  const STATUS_LABELS: Record<Vendor['status'], string> = vm.status;
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
  const [tinTarget, setTinTarget] = useState<VendorTinTarget | null>(null);

  const applyTin = (kind: VendorTinTarget['kind'], id: string, tin: string | null) => {
    if (kind === 'stores') setStores((prev) => prev.map((v) => (v.id === id ? { ...v, tin } : v)));
    else setRestaurants((prev) => prev.map((v) => (v.id === id ? { ...v, tin } : v)));
  };

  const load = async () => {
    setIsLoading(true);
    try {
      const [s, r] = await Promise.all([marketAdminApi.getAll(), foodAdminApi.getAll()]);
      setStores(s.data.data);
      setRestaurants(r.data.data);
      setError(null);
    } catch {
      // Last good rows stay on screen; DataTable shows banner + retry.
      setError(vm.loadError);
      toast({ title: m.common.error, description: vm.loadError, variant: 'error' });
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
      label: vm.chipSearch(search.trim()),
      onRemove: () => {
        setSearch('');
        pagination.reset();
      },
    });
  }
  if (statusFilter !== 'all') {
    chips.push({
      key: 'status',
      label: vm.chipStatus(STATUS_LABELS[statusFilter]),
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
        title: next === 'closed' ? vm.closedToast(v.name) : vm.openedToast(v.name),
        description: next === 'closed' ? vm.closedDesc : vm.openedDesc,
        variant: 'success',
      });
    } catch {
      toast({ title: m.common.error, description: vm.statusChangeFailed, variant: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) return;
    downloadCsv<Vendor>(
      vm.csvFile(tab === 'stores', new Date().toISOString().slice(0, 10)),
      [
        { header: vm.colName, value: (v) => v.name },
        { header: vm.colOwner, value: (v) => ownerName(v) },
        { header: vm.colPhone, value: (v) => v.owner.phone },
        { header: vm.colAddress, value: (v) => v.address ?? '' },
        { header: vm.colTin, value: (v) => v.tin ?? '' },
        { header: vm.colStatus, value: (v) => STATUS_LABELS[v.status] },
        { header: vm.colAddedDate, value: (v) => formatDate(v.createdAt) },
      ],
      filteredRows
    );
    toast({ title: vm.csvDone, description: vm.csvRows(filteredRows.length), variant: 'success' });
  };

  const addLabel = tab === 'stores' ? vm.newStore : vm.newRestaurant;

  const columns: DataTableColumn<Vendor>[] = [
    {
      key: 'name',
      header: vm.colName,
      sortable: true,
      cell: (v) => <span className="font-medium text-ink">{v.name}</span>,
    },
    {
      key: 'owner',
      header: vm.colOwner,
      cell: (v) => (
        <div className="min-w-0 leading-tight">
          <p className="text-ink truncate">{ownerName(v)}</p>
          <p className="num text-xs text-muted whitespace-nowrap">{formatPhone(v.owner.phone)}</p>
        </div>
      ),
    },
    {
      key: 'address',
      header: vm.colAddress,
      hideBelow: 'lg',
      className: 'max-w-[240px]',
      cell: (v) => (
        <p className="truncate text-muted" title={v.address ?? undefined}>
          {v.address ?? '—'}
        </p>
      ),
    },
    {
      // Fiskal chekda komitent STIR'i (LEGAL-COMPLIANCE §3). Sotuvchi o'zi
      // kiritadi; admin bu yerdan tuzatadi (§23, audit `vendor.tin_update`).
      key: 'tin',
      header: vm.colTin,
      hideBelow: 'lg',
      cell: (v) => (
        <button
          type="button"
          onClick={() => setTinTarget({ kind: tab, id: v.id, name: v.name, tin: v.tin })}
          aria-label={vm.editTinAria(v.name)}
          title={v.tin ? vm.editTin : vm.noTinHint}
          className="group inline-flex items-center gap-1.5 rounded-ds-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {v.tin ? (
            <span className="font-mono text-xs text-ink">{v.tin}</span>
          ) : (
            <span className="text-subtle">—</span>
          )}
          <Pencil size={12} aria-hidden className="text-subtle opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
        </button>
      ),
    },
    {
      key: 'status',
      header: vm.colStatus,
      sortable: true,
      cell: (v) => (
        <Badge variant={v.status === 'active' ? 'success' : 'neutral'} dot>
          {STATUS_LABELS[v.status]}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: vm.colAdded,
      sortable: true,
      hideBelow: 'md',
      cell: (v) => <span className="num text-muted whitespace-nowrap">{formatDateShort(v.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">{vm.colAction}</span>,
      align: 'right',
      cell: (v) => (
        <Button
          variant={v.status === 'active' ? 'secondary' : 'primary'}
          size="sm"
          isLoading={togglingId === v.id}
          onClick={() => toggleStatus(v)}
        >
          {v.status === 'active' ? vm.close : vm.open}
        </Button>
      ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={vm.title}
        description={vm.description}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
              leftIcon={<Download size={14} aria-hidden />}
            >
              {vm.exportCsv}
            </Button>
            <Button leftIcon={<Plus size={14} aria-hidden />} onClick={() => setShowAdd(true)}>
              {addLabel}
            </Button>
          </>
        }
      />

      <Tabs
        ariaLabel={vm.tabsAria}
        className="mb-4"
        items={[
          { value: 'stores', label: vm.stores, count: stores.length },
          { value: 'restaurants', label: vm.restaurants, count: restaurants.length },
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v as Tab);
          pagination.reset();
        }}
      />

      <DataTable
        ariaLabel={tab === 'stores' ? vm.stores : vm.restaurants}
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
            searchPlaceholder={vm.searchPlaceholder}
            searchAriaLabel={vm.searchAria}
            chips={chips}
            onClearAll={clearAllFilters}
          >
            <SegmentedControl
              ariaLabel={vm.statusFilter}
              items={statusItems()}
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
        emptyFiltered={{ title: vm.noMatchTitle, description: tab === 'stores' ? vm.noMatchStores : vm.noMatchRestaurants }}
        empty={{
          variant: 'first-use',
          icon: tab === 'stores' ? <Store aria-hidden /> : <UtensilsCrossed aria-hidden />,
          title: tab === 'stores' ? vm.emptyStores : vm.emptyRestaurants,
          description: vm.emptyDesc,
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

      <VendorTinModal target={tinTarget} onClose={() => setTinTarget(null)} onSaved={applyTin} />

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
  const m = t();
  const a = m.vendors.add;
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
    if (!phone.trim()) errors.phone = a.phoneRequired;
    else if (!/^\+?998\d{9}$/.test(phone.trim().replace(/[\s-]/g, '')))
      errors.phone = a.phoneFormat;
    if (!name.trim()) errors.name = a.nameRequired;
    if (lat && Number.isNaN(Number(lat))) errors.lat = a.mustBeNumber;
    if (lng && Number.isNaN(Number(lng))) errors.lng = a.mustBeNumber;
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
      toast({ title: a.added, variant: 'success' });
      setPhone(''); setFirstName(''); setLastName(''); setName('');
      setAddress(''); setVendorPhone(''); setLat(''); setLng('');
      setFieldErrors({});
      await onCreated();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        a.addFailed;
      toast({ title: m.common.error, description: message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="lg"
      title={kind === 'stores' ? a.titleStore : a.titleRestaurant}
      description={a.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {m.common.cancel}
          </Button>
          <Button onClick={save} isLoading={saving}>
            {m.common.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Input
          label={a.ownerPhone}
          placeholder="+998901234599"
          type="tel"
          className="num"
          value={phone}
          error={fieldErrors.phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label={a.firstName} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label={a.lastName} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input
          label={kind === 'stores' ? a.storeName : a.restaurantName}
          value={name}
          error={fieldErrors.name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input label={a.address} value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input
          label={a.contactPhone}
          hint={a.contactPhoneHint}
          type="tel"
          className="num"
          value={vendorPhone}
          onChange={(e) => setVendorPhone(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={a.lat}
            placeholder="40.0956"
            inputMode="decimal"
            className="num"
            value={lat}
            error={fieldErrors.lat}
            onChange={(e) => setLat(e.target.value)}
          />
          <Input
            label={a.lng}
            placeholder="70.9432"
            inputMode="decimal"
            className="num"
            value={lng}
            error={fieldErrors.lng}
            onChange={(e) => setLng(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted">
          {a.coordsNote}
        </p>
      </div>
    </Modal>
  );
}
