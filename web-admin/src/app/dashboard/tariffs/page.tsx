'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { tariffsApi, Tariff, TariffCreateInput } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate } from '@/lib/utils';

const tariffSchema = z.object({
  name: z.string().min(2, 'Kamida 2 ta harf'),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0, 'Manfiy qiymat bo\'lmasin'),
  pricePerKm: z.coerce.number().min(0, 'Manfiy qiymat bo\'lmasin'),
  pricePerMin: z.coerce.number().min(0, 'Manfiy qiymat bo\'lmasin'),
  minPrice: z.coerce.number().min(0, 'Manfiy qiymat bo\'lmasin'),
  isActive: z.boolean().optional(),
});

type TariffForm = z.infer<typeof tariffSchema>;

export default function TariffsPage() {
  const { toast } = useToast();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tariff | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TariffForm>({ resolver: zodResolver(tariffSchema) });

  const fetchTariffs = async () => {
    setIsLoading(true);
    try {
      const res = await tariffsApi.getAll();
      setTariffs(res.data.data);
    } catch {
      toast({ title: 'Xatolik', description: 'Tariflarni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTariffs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingTariff(null);
    reset({
      name: '',
      description: '',
      basePrice: 0,
      pricePerKm: 0,
      pricePerMin: 0,
      minPrice: 0,
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (tariff: Tariff) => {
    setEditingTariff(tariff);
    reset({
      name: tariff.name,
      description: tariff.description || '',
      basePrice: tariff.basePrice,
      pricePerKm: tariff.pricePerKm,
      pricePerMin: tariff.pricePerMin,
      minPrice: tariff.minPrice,
      isActive: tariff.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async (data: TariffForm) => {
    setSaving(true);
    try {
      const payload: TariffCreateInput = {
        name: data.name,
        description: data.description,
        basePrice: data.basePrice,
        pricePerKm: data.pricePerKm,
        pricePerMin: data.pricePerMin,
        minPrice: data.minPrice,
        isActive: data.isActive ?? true,
      };
      if (editingTariff) {
        await tariffsApi.update(editingTariff.id, payload);
        toast({ title: 'Tarif yangilandi', variant: 'success' });
      } else {
        await tariffsApi.create(payload);
        toast({ title: 'Tarif yaratildi', variant: 'success' });
      }
      setModalOpen(false);
      await fetchTariffs();
    } catch {
      toast({ title: 'Xatolik', description: 'Tarifni saqlashda xatolik', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (tariff: Tariff) => {
    try {
      const res = await tariffsApi.toggleActive(tariff.id);
      setTariffs((prev) => prev.map((t) => (t.id === tariff.id ? res.data.data : t)));
      toast({
        title: res.data.data.isActive ? 'Tarif yoqildi' : 'Tarif o\'chirildi',
        variant: 'success',
      });
    } catch {
      toast({ title: 'Xatolik', variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await tariffsApi.delete(deleteTarget.id);
      toast({ title: 'Tarif o\'chirildi', variant: 'success' });
      setDeleteTarget(null);
      await fetchTariffs();
    } catch {
      toast({ title: 'Xatolik', description: 'Tarifni o\'chirishda xatolik', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <Header title="Tariflar" subtitle="Narx siyosatini boshqaring" />
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Yangi tarif
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : tariffs.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-sm text-gray-500">Tariflar yo&apos;q</p>
              <Button className="mt-4" onClick={openCreate}>
                Birinchi tarifni yarating
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tariffs.map((tariff) => (
              <Card key={tariff.id} className={tariff.isActive ? '' : 'opacity-60'}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{tariff.name}</CardTitle>
                    <Badge variant={tariff.isActive ? 'success' : 'secondary'}>
                      {tariff.isActive ? 'Faol' : 'Nofaol'}
                    </Badge>
                  </div>
                  {tariff.description && (
                    <p className="text-xs text-gray-500 mt-1">{tariff.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm pb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-gray-50 p-2 text-center">
                      <p className="text-xs text-gray-500">Boshlang&apos;ich</p>
                      <p className="font-semibold text-gray-900 text-xs mt-0.5">
                        {formatCurrency(tariff.basePrice)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2 text-center">
                      <p className="text-xs text-gray-500">Minimum</p>
                      <p className="font-semibold text-gray-900 text-xs mt-0.5">
                        {formatCurrency(tariff.minPrice)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2 text-center">
                      <p className="text-xs text-gray-500">Har km uchun</p>
                      <p className="font-semibold text-gray-900 text-xs mt-0.5">
                        {formatCurrency(tariff.pricePerKm)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2 text-center">
                      <p className="text-xs text-gray-500">Har min uchun</p>
                      <p className="font-semibold text-gray-900 text-xs mt-0.5">
                        {formatCurrency(tariff.pricePerMin)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Yangilangan: {formatDate(tariff.updatedAt, 'dd.MM.yyyy')}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      onClick={() => handleToggle(tariff)}
                    >
                      {tariff.isActive ? (
                        <ToggleRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-gray-400" />
                      )}
                      {tariff.isActive ? 'O\'chirish' : 'Yoqish'}
                    </button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(tariff)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hover:text-red-600"
                        onClick={() => setDeleteTarget(tariff)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTariff ? 'Tarifni tahrirlash' : 'Yangi tarif'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
            <Input
              label="Tarif nomi"
              placeholder="Standart, Premium, Ekonom..."
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Tavsif (ixtiyoriy)"
              placeholder="Qisqacha tavsif..."
              {...register('description')}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Boshlang'ich narx (UZS)"
                type="number"
                placeholder="5000"
                error={errors.basePrice?.message}
                {...register('basePrice')}
              />
              <Input
                label="Minimum narx (UZS)"
                type="number"
                placeholder="8000"
                error={errors.minPrice?.message}
                {...register('minPrice')}
              />
              <Input
                label="1 km narxi (UZS)"
                type="number"
                placeholder="1500"
                error={errors.pricePerKm?.message}
                {...register('pricePerKm')}
              />
              <Input
                label="1 min narxi (UZS)"
                type="number"
                placeholder="300"
                error={errors.pricePerMin?.message}
                {...register('pricePerMin')}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" className="rounded accent-brand-yellow" {...register('isActive')} />
              Darhol faol qilish
            </label>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Bekor qilish
              </Button>
              <Button type="submit" isLoading={saving}>
                {editingTariff ? 'Saqlash' : 'Yaratish'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm modal */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tarifni o&apos;chirish</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            <strong>{deleteTarget?.name}</strong> tarifini o&apos;chirmoqchimisiz? Bu amalni bekor qilib
            bo&apos;lmaydi.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Bekor qilish
            </Button>
            <Button variant="destructive" isLoading={deleting} onClick={handleDelete}>
              O&apos;chirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
