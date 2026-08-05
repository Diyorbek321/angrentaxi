'use client';

import { useEffect, useState } from 'react';
import { Plus, Store, UtensilsCrossed } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/Table';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  marketAdminApi,
  foodAdminApi,
  StoreVendor,
  RestaurantVendor,
  CreateStoreVendorInput,
  CreateRestaurantVendorInput,
} from '@/lib/api';

type Tab = 'stores' | 'restaurants';

export default function VendorsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('stores');
  const [stores, setStores] = useState<StoreVendor[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const [s, r] = await Promise.all([marketAdminApi.getAll(), foodAdminApi.getAll()]);
      setStores(s.data.data);
      setRestaurants(r.data.data);
      setLoadError(null);
    } catch {
      setLoadError('Sotuvchilarni yuklashda xatolik');
      toast({ title: 'Xatolik', description: 'Sotuvchilarni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStoreStatus = async (v: StoreVendor) => {
    try {
      await marketAdminApi.setStatus(v.id, v.status === 'active' ? 'closed' : 'active');
      await load();
    } catch {
      toast({ title: 'Xatolik', variant: 'error' });
    }
  };

  const toggleRestaurantStatus = async (v: RestaurantVendor) => {
    try {
      await foodAdminApi.setStatus(v.id, v.status === 'active' ? 'closed' : 'active');
      await load();
    } catch {
      toast({ title: 'Xatolik', variant: 'error' });
    }
  };

  const vendorName = (v: StoreVendor | RestaurantVendor) =>
    [v.owner.firstName, v.owner.lastName].filter(Boolean).join(' ') || '—';

  const rows = tab === 'stores' ? stores : restaurants;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Sotuvchilar"
        description="Market do'konlari va restoranlarni boshqarish"
        icon={<Store className="h-4 w-4" />}
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>
            {tab === 'stores' ? "Yangi do'kon" : 'Yangi restoran'}
          </Button>
        }
      />

      <div className="space-y-4">
        <Tabs
          ariaLabel="Sotuvchi turi"
          items={[
            { value: 'stores', label: "Do'konlar", count: stores.length },
            { value: 'restaurants', label: 'Restoranlar', count: restaurants.length },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />

        {loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : isLoading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : rows.length === 0 ? (
          <div className="rounded-ds-md border border-line bg-surface">
            <EmptyState
              icon={tab === 'stores' ? <Store className="h-6 w-6" /> : <UtensilsCrossed className="h-6 w-6" />}
              title={tab === 'stores' ? "Hali do'kon yo'q" : 'Hali restoran yo\'q'}
              description="Yangi sotuvchi qo'shish uchun yuqoridagi tugmani bosing."
              action={
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>
                  {tab === 'stores' ? "Yangi do'kon" : 'Yangi restoran'}
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomi</TableHead>
                <TableHead>Egasi</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Manzil</TableHead>
                <TableHead>Holat</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tab === 'stores'
                ? stores.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-semibold">{v.name}</TableCell>
                      <TableCell className="text-muted">{vendorName(v)}</TableCell>
                      <TableCell className="font-mono text-muted">{v.owner.phone}</TableCell>
                      <TableCell className="text-muted">{v.address ?? '—'}</TableCell>
                      <TableCell>
                        <StatusPill active={v.status === 'active'} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => toggleStoreStatus(v)}>
                          {v.status === 'active' ? 'Yopish' : 'Ochish'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                : restaurants.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-semibold">{v.name}</TableCell>
                      <TableCell className="text-muted">{vendorName(v)}</TableCell>
                      <TableCell className="font-mono text-muted">{v.owner.phone}</TableCell>
                      <TableCell className="text-muted">{v.address ?? '—'}</TableCell>
                      <TableCell>
                        <StatusPill active={v.status === 'active'} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => toggleRestaurantStatus(v)}>
                          {v.status === 'active' ? 'Yopish' : 'Ochish'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
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

function StatusPill({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'success' : 'danger'} dot>
      {active ? 'Faol' : 'Yopiq'}
    </Badge>
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

  const save = async () => {
    if (!phone.trim() || !name.trim()) return;
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
            {kind === 'stores' ? "Yangi do'kon qo'shish" : 'Yangi restoran qo\'shish'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3.5">
          <Input
            label="Egasi telefon raqami"
            placeholder="+998901234599"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ismi" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input label="Familiyasi" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <Input
            label={kind === 'stores' ? "Do'kon nomi" : 'Restoran nomi'}
            value={name}
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
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
            <Input
              label="Lng (uzunlik)"
              placeholder="70.9432"
              value={lng}
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
          <Button onClick={save} isLoading={saving} disabled={!phone.trim() || !name.trim()}>
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
