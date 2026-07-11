'use client';

import { useEffect, useState } from 'react';
import { Check, LocateFixed } from 'lucide-react';
import { marketApi, Store } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function SettingsPage() {
  const { toast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('22:00');
  const [deliveryMode, setDeliveryMode] = useState<'self' | 'platform'>('platform');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    marketApi.getStore().then((res) => {
      const s = res.data.data;
      setStore(s);
      setName(s.name);
      setPhone(s.phone ?? '');
      setAddress(s.address ?? '');
      setLat(s.lat != null ? String(s.lat) : '');
      setLng(s.lng != null ? String(s.lng) : '');
      setStart(s.workingHoursStart);
      setEnd(s.workingHoursEnd);
      setDeliveryMode(s.deliveryMode);
    });
  }, []);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Joylashuv qo‘llab-quvvatlanmaydi', variant: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocating(false);
      },
      () => {
        toast({ title: 'Joylashuvga ruxsat berilmadi', variant: 'error' });
        setLocating(false);
      }
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await marketApi.updateStore({
        name,
        phone,
        address,
        workingHoursStart: start,
        workingHoursEnd: end,
        deliveryMode,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
      });
      setStore(res.data.data);
      toast({ title: 'Saqlandi', variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', description: 'Saqlab bo‘lmadi', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!store) {
    return <div className="text-slate-500 text-sm">Yuklanmoqda...</div>;
  }

  return (
    <div className="animate-fade-in max-w-[720px] flex flex-col gap-4">
      <div
        className="rounded-2xl border border-white/[0.07] px-[22px] py-5"
        style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
      >
        <div className="text-[15px] font-bold mb-[18px]">Do&apos;kon ma&apos;lumotlari</div>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Do'kon nomi">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </Field>
          <Field label="Telefon">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </Field>
          <div className="col-span-2">
            <Field label="Olib ketish manzili">
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
            </Field>
          </div>
          <Field label="Kenglik (lat)">
            <input value={lat} onChange={(e) => setLat(e.target.value)} className="input" placeholder="40.0956" />
          </Field>
          <Field label="Uzunlik (lng)">
            <input value={lng} onChange={(e) => setLng(e.target.value)} className="input" placeholder="70.9432" />
          </Field>
          <div className="col-span-2">
            <button
              onClick={useCurrentLocation}
              disabled={locating}
              type="button"
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-yellow hover:underline disabled:opacity-50"
            >
              <LocateFixed className="h-3.5 w-3.5" />
              {locating ? 'Aniqlanmoqda...' : 'Hozirgi joylashuvni olish'}
            </button>
            <p className="text-[11px] text-slate-500 mt-1">
              Kuryer buyurtmani shu manzildan olib ketadi — koordinatalar aniq bo&apos;lishi kerak.
            </p>
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl border border-white/[0.07] px-[22px] py-5"
        style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
      >
        <div className="text-[15px] font-bold mb-4">Yetkazib berish usuli</div>
        <div className="flex gap-3">
          <DeliveryOption
            title="O'zi yetkazadi"
            desc="Do'kon o'z kuryeri bilan yetkazadi"
            active={deliveryMode === 'self'}
            onClick={() => setDeliveryMode('self')}
          />
          <DeliveryOption
            title="Platforma kuryeri"
            desc="Angren Taxi kuryerlari yetkazadi"
            active={deliveryMode === 'platform'}
            onClick={() => setDeliveryMode('platform')}
          />
        </div>
      </div>

      <div
        className="rounded-2xl border border-white/[0.07] px-[22px] py-5"
        style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
      >
        <div className="text-[15px] font-bold mb-4">Ish vaqti</div>
        <div className="flex items-center gap-3.5">
          <input value={start} onChange={(e) => setStart(e.target.value)} className="input w-[90px] text-center font-bold" />
          <span className="text-slate-500">—</span>
          <input value={end} onChange={(e) => setEnd(e.target.value)} className="input w-[90px] text-center font-bold" />
          <span className="text-[12.5px] text-slate-500 ml-1.5">Har kuni</span>
        </div>
      </div>

      <div className="flex justify-end gap-2.5">
        <button
          onClick={save}
          disabled={saving}
          className="bg-brand-yellow text-brand-dark rounded-[11px] px-[22px] py-[11px] text-sm font-extrabold flex items-center gap-2 disabled:opacity-50 hover:bg-yellow-300"
        >
          <Check className="h-4 w-4" />
          Saqlash
        </button>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 10px;
          padding: 10px 13px;
          color: #e5e7eb;
          font-size: 13px;
          font-weight: 600;
        }
        .input:focus {
          outline: none;
          border-color: #facc15;
        }
      `}</style>
    </div>
  );
}

function DeliveryOption({
  title,
  desc,
  active,
  onClick,
}: {
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex-1 cursor-pointer rounded-[13px] p-[15px] border-[1.5px] ${
        active ? 'border-brand-yellow bg-brand-yellow/[0.06]' : 'border-white/[0.09] bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-bold">{title}</span>
        <span className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${active ? 'border-brand-yellow' : 'border-white/25'}`}>
          {active && <span className="w-2 h-2 rounded-full bg-brand-yellow" />}
        </span>
      </div>
      <div className="text-xs text-slate-500 mt-1.5">{desc}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-400 font-semibold block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
