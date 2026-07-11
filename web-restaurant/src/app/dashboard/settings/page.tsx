'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, LocateFixed, Smartphone, Volume2 } from 'lucide-react';
import { foodApi, Notifications, Restaurant, WorkingHoursDay } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function SettingsPage() {
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [hours, setHours] = useState<WorkingHoursDay[]>([]);
  const [radius, setRadius] = useState(7);
  const [notifications, setNotifications] = useState<Notifications>({ sound: true, push: true, sms: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    foodApi.getRestaurant().then((res) => {
      const r = res.data.data;
      setRestaurant(r);
      setName(r.name);
      setPhone(r.phone ?? '');
      setAddress(r.address ?? '');
      setLat(r.lat != null ? String(r.lat) : '');
      setLng(r.lng != null ? String(r.lng) : '');
      setHours(r.hours);
      setRadius(r.deliveryRadiusKm);
      setNotifications(r.notifications);
    });
  }, []);

  const toggleDay = (idx: number) => {
    setHours((prev) => prev.map((h, i) => (i === idx ? { ...h, open: !h.open } : h)));
  };

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
      const res = await foodApi.updateRestaurant({
        name,
        phone,
        address,
        hours,
        deliveryRadiusKm: radius,
        notifications,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
      });
      setRestaurant(res.data.data);
      toast({ title: 'Saqlandi', variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', description: 'Saqlab bo‘lmadi', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!restaurant) {
    return <div className="text-slate-500 text-sm">Yuklanmoqda...</div>;
  }

  return (
    <div className="max-w-[900px] mx-auto grid gap-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
      <div className="bg-[#111827] border border-white/[0.07] rounded-2xl p-[22px]">
        <h4 className="text-[15px] font-bold mb-[18px]">Restoran ma&apos;lumotlari</h4>
        <div className="flex flex-col gap-3.5">
          <Field label="Nomi">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </Field>
          <Field label="Telefon">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input font-mono" />
          </Field>
          <Field label="Manzil">
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
          </Field>
          <div className="flex gap-3">
            <Field label="Kenglik (lat)">
              <input value={lat} onChange={(e) => setLat(e.target.value)} className="input" placeholder="40.1050" />
            </Field>
            <Field label="Uzunlik (lng)">
              <input value={lng} onChange={(e) => setLng(e.target.value)} className="input" placeholder="70.9500" />
            </Field>
          </div>
          <button
            onClick={useCurrentLocation}
            disabled={locating}
            type="button"
            className="flex items-center gap-1.5 text-xs font-semibold text-brand-yellow hover:underline disabled:opacity-50 self-start"
          >
            <LocateFixed className="h-3.5 w-3.5" />
            {locating ? 'Aniqlanmoqda...' : 'Hozirgi joylashuvni olish'}
          </button>
          <p className="text-[11px] text-slate-500">
            Kuryer buyurtmani shu manzildan olib ketadi — koordinatalar aniq bo&apos;lishi kerak.
          </p>
        </div>
      </div>

      <div className="bg-[#111827] border border-white/[0.07] rounded-2xl p-[22px]">
        <h4 className="text-[15px] font-bold mb-[18px]">Ish vaqti</h4>
        <div className="flex flex-col gap-2.5">
          {hours.map((h, idx) => (
            <div key={h.day} className="flex items-center gap-3">
              <span className="w-24 text-[13px] font-semibold">{h.day}</span>
              <button
                onClick={() => toggleDay(idx)}
                className="w-[42px] h-6 rounded-full p-0.5 flex-shrink-0 flex items-center transition-colors"
                style={{ background: h.open ? '#10B981' : 'rgba(255,255,255,0.14)', justifyContent: h.open ? 'flex-end' : 'flex-start' }}
              >
                <span className="w-5 h-5 rounded-full bg-white block" />
              </button>
              <span className="font-mono text-[13px] text-slate-400 flex-1 text-right">
                {h.open ? `${h.from} – ${h.to}` : 'Dam olish kuni'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#111827] border border-white/[0.07] rounded-2xl p-[22px]">
        <h4 className="text-[15px] font-bold mb-1.5">Yetkazib berish zonasi</h4>
        <p className="text-[12.5px] text-slate-500 mb-4">
          Radius: <span className="font-mono text-brand-yellow font-bold">{radius} km</span>
        </p>
        <div
          className="relative h-[180px] rounded-[14px] overflow-hidden border border-white/[0.06] flex items-center justify-center mb-4"
          style={{ background: 'radial-gradient(circle at 50% 50%, #16233b, #0d1526)' }}
        >
          <div className="absolute w-[150px] h-[150px] rounded-full border border-brand-yellow/15" />
          <div className="absolute w-[100px] h-[100px] rounded-full border border-brand-yellow/25 bg-brand-yellow/5" />
          <div className="absolute w-[52px] h-[52px] rounded-full border border-brand-yellow/40 bg-brand-yellow/[0.08]" />
          <div className="w-3.5 h-3.5 rounded-full bg-brand-yellow z-10" style={{ boxShadow: '0 0 16px rgba(250,204,21,0.6)' }} />
        </div>
        <input
          type="range"
          min={1}
          max={15}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full accent-brand-yellow"
        />
      </div>

      <div className="bg-[#111827] border border-white/[0.07] rounded-2xl p-[22px]">
        <h4 className="text-[15px] font-bold mb-[18px]">Bildirishnomalar</h4>
        <div className="flex flex-col gap-4">
          <NotifRow
            icon={<Volume2 className="h-[18px] w-[18px] text-brand-yellow" />}
            title="Yangi buyurtma ovozi"
            subtitle="Buyurtma kelganda signal chalinadi"
            on={notifications.sound}
            onToggle={() => setNotifications((n) => ({ ...n, sound: !n.sound }))}
          />
          <NotifRow
            icon={<Bell className="h-[18px] w-[18px] text-slate-400" />}
            title="Push bildirishnomalar"
            subtitle="Brauzer bildirishnomalari"
            on={notifications.push}
            onToggle={() => setNotifications((n) => ({ ...n, push: !n.push }))}
          />
          <NotifRow
            icon={<Smartphone className="h-[18px] w-[18px] text-slate-400" />}
            title="SMS xabarnoma"
            subtitle="Muhim voqealar haqida SMS"
            on={notifications.sms}
            onToggle={() => setNotifications((n) => ({ ...n, sms: !n.sms }))}
          />
        </div>
      </div>

      <div className="col-span-full flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-brand-yellow text-brand-black rounded-[11px] px-[22px] py-[11px] text-sm font-bold disabled:opacity-50 hover:bg-yellow-300"
        >
          <Check className="h-4 w-4" />
          Saqlash
        </button>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          background: #0d1526;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #f1f5f9;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 14px;
          outline: none;
        }
        .input:focus {
          border-color: #facc15;
        }
      `}</style>
    </div>
  );
}

function NotifRow({
  icon,
  title,
  subtitle,
  on,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold">{title}</div>
        <div className="text-[11.5px] text-slate-500">{subtitle}</div>
      </div>
      <button
        onClick={onToggle}
        className="w-[42px] h-6 rounded-full p-0.5 flex-shrink-0 flex items-center transition-colors"
        style={{ background: on ? '#FACC15' : 'rgba(255,255,255,0.14)', justifyContent: on ? 'flex-end' : 'flex-start' }}
      >
        <span className="w-5 h-5 rounded-full bg-white block" />
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-slate-400 font-semibold">{label}</span>
      {children}
    </label>
  );
}
