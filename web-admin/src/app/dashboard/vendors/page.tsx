'use client';

import { useEffect, useState } from 'react';
import { Plus, Store, UtensilsCrossed, X } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const [s, r] = await Promise.all([marketAdminApi.getAll(), foodAdminApi.getAll()]);
      setStores(s.data.data);
      setRestaurants(r.data.data);
    } catch {
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

  return (
    <>
      <Header title="Sotuvchilar" subtitle="Market do'konlari va restoranlarni boshqarish" />
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 rounded-xl bg-white/[0.04] border border-white/[0.08] p-1">
            <TabButton active={tab === 'stores'} onClick={() => setTab('stores')} icon={Store} label={`Do'konlar (${stores.length})`} />
            <TabButton
              active={tab === 'restaurants'}
              onClick={() => setTab('restaurants')}
              icon={UtensilsCrossed}
              label={`Restoranlar (${restaurants.length})`}
            />
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {tab === 'stores' ? "Yangi do'kon" : 'Yangi restoran'}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0D1526]">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="text-left text-slate-500 text-xs font-semibold uppercase tracking-wide border-b border-white/[0.08]">
                <th className="px-5 py-3">Nomi</th>
                <th className="px-5 py-3">Egasi</th>
                <th className="px-5 py-3">Telefon</th>
                <th className="px-5 py-3">Manzil</th>
                <th className="px-5 py-3">Holat</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500 text-sm">
                    Yuklanmoqda...
                  </td>
                </tr>
              )}
              {!isLoading && tab === 'stores' && stores.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500 text-sm">
                    Hali do&apos;kon yo&apos;q
                  </td>
                </tr>
              )}
              {!isLoading &&
                tab === 'stores' &&
                stores.map((v) => (
                  <tr key={v.id} className="border-b border-white/[0.05]">
                    <td className="px-5 py-3.5 font-semibold text-sm text-white">{v.name}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-300">{vendorName(v)}</td>
                    <td className="px-5 py-3.5 font-mono text-sm text-slate-400">{v.owner.phone}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-400">{v.address ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill active={v.status === 'active'} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => toggleStoreStatus(v)}
                        className="text-xs font-semibold text-slate-400 hover:text-yellow-400"
                      >
                        {v.status === 'active' ? 'Yopish' : 'Ochish'}
                      </button>
                    </td>
                  </tr>
                ))}
              {!isLoading && tab === 'restaurants' && restaurants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500 text-sm">
                    Hali restoran yo&apos;q
                  </td>
                </tr>
              )}
              {!isLoading &&
                tab === 'restaurants' &&
                restaurants.map((v) => (
                  <tr key={v.id} className="border-b border-white/[0.05]">
                    <td className="px-5 py-3.5 font-semibold text-sm text-white">{v.name}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-300">{vendorName(v)}</td>
                    <td className="px-5 py-3.5 font-mono text-sm text-slate-400">{v.owner.phone}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-400">{v.address ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill active={v.status === 'active'} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => toggleRestaurantStatus(v)}
                        className="text-xs font-semibold text-slate-400 hover:text-yellow-400"
                      >
                        {v.status === 'active' ? 'Yopish' : 'Ochish'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <AddVendorModal
          kind={tab}
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await load();
          }}
        />
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Store;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        active ? 'bg-yellow-400 text-[#080D1A]' : 'text-slate-400 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
        active ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-400' : 'bg-red-400'}`} />
      {active ? 'Faol' : 'Yopiq'}
    </span>
  );
}

function AddVendorModal({
  kind,
  onClose,
  onCreated,
}: {
  kind: Tab;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div onClick={onClose} className="absolute inset-0 bg-black/65" />
      <div className="relative w-[520px] max-w-full max-h-[90vh] overflow-y-auto bg-[#0D1526] border border-white/[0.09] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">
            {kind === 'stores' ? "Yangi do'kon qo'shish" : 'Yangi restoran qo\'shish'}
          </h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-white/[0.08] text-slate-400 flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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
            <Input label="Lat (kenglik)" placeholder="40.0956" value={lat} onChange={(e) => setLat(e.target.value)} />
            <Input label="Lng (uzunlik)" placeholder="70.9432" value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>
          <p className="text-xs text-slate-500">
            Koordinatalar kuryer yuborish uchun kerak — hozir qoldirilsa, keyinroq sotuvchi o&apos;zi
            Sozlamalar bo&apos;limidan kiritishi mumkin.
          </p>
        </div>
        <div className="flex gap-2.5 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button className="flex-1" onClick={save} isLoading={saving} disabled={!phone.trim() || !name.trim()}>
            Saqlash
          </Button>
        </div>
      </div>
    </div>
  );
}
