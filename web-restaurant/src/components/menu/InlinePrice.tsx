'use client';

import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { foodApi, Dish } from '@/lib/api';
import { errorMessage } from '@/hooks/useAsyncData';
import { cn } from '@/components/ui/cn';
import { controlBase, controlBorder } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { MoneyText } from '@/components/ui/MoneyText';
import { useToast } from '@/components/ui/Toast';

/**
 * Bir maydonlik tuzatish uchun to'liq forma ochilmaydi — narx joyida
 * tahrirlanadi (ko'rinadigan qalam affordance bilan). Backend PATCH qisman
 * yangilashni qo'llaydi, faqat `price` yuboriladi.
 */
export function InlinePrice({ dish, onSaved }: { dish: Dish; onSaved: (updated: Dish) => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const start = () => {
    setValue(String(dish.price));
    setEditing(true);
  };

  const commit = async () => {
    const price = Number(value);
    if (!value.trim() || !Number.isFinite(price) || price <= 0) {
      toast({ title: "Narx 0 dan katta bo'lishi kerak", variant: 'error' });
      return;
    }
    if (price === dish.price) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await foodApi.updateDish(dish.id, { price });
      onSaved(res.data.data);
      toast({ title: `${dish.name} — narx yangilandi`, variant: 'success' });
      setEditing(false);
    } catch (err) {
      toast({ title: 'Narxni saqlab bo‘lmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <span className="inline-flex items-center justify-end gap-0.5">
        <MoneyText value={dish.price} className="font-medium text-ink" />
        <IconButton size="sm" aria-label={`${dish.name} — narxini o'zgartirish`} title="Narxni oʻzgartirish" onClick={start}>
          <Pencil aria-hidden />
        </IconButton>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-end gap-1">
      <input
        type="number"
        min={0}
        step={500}
        autoFocus
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label={`${dish.name} — yangi narx (so'm)`}
        className={cn(controlBase, controlBorder(false), 'num h-7 w-24 px-2 text-right text-[13px]')}
      />
      <IconButton size="sm" variant="secondary" aria-label="Narxni saqlash" disabled={saving} onClick={commit}>
        <Check aria-hidden />
      </IconButton>
      <IconButton size="sm" aria-label="Tahrirni bekor qilish" disabled={saving} onClick={() => setEditing(false)}>
        <X aria-hidden />
      </IconButton>
    </span>
  );
}
