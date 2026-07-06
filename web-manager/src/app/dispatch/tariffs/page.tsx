'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil } from 'lucide-react';
import {
  getTariffs,
  getTariffChangeRequests,
  proposeTariffChange,
  Tariff,
  TariffChangeRequest,
} from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const schema = z.object({
  name: z.string().min(2, 'Nomi kerak'),
  basePrice: z.coerce.number().min(0),
  pricePerKm: z.coerce.number().min(0),
  pricePerMin: z.coerce.number().min(0),
  minPrice: z.coerce.number().min(0),
  maxPrice: z.coerce.number().min(0).optional(),
});

type FormData = z.infer<typeof schema>;

const statusBadge: Record<TariffChangeRequest['status'], { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Kutilmoqda', variant: 'warning' },
  approved: { label: 'Tasdiqlangan', variant: 'success' },
  rejected: { label: 'Rad etilgan', variant: 'danger' },
};

export default function TariffsPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [requests, setRequests] = useState<TariffChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [tariffsData, requestsData] = await Promise.all([
        getTariffs(),
        getTariffChangeRequests(),
      ]);
      setTariffs(tariffsData);
      setRequests(requestsData);
    } catch {
      setError('Ma\'lumotlarni yuklab bo\'lmadi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openProposeNew = () => {
    setEditingTariff(null);
    reset({ name: '', basePrice: 0, pricePerKm: 0, pricePerMin: 0, minPrice: 0, maxPrice: undefined });
    setIsModalOpen(true);
  };

  const openProposeEdit = (tariff: Tariff) => {
    setEditingTariff(tariff);
    reset({
      name: tariff.name,
      basePrice: tariff.basePrice,
      pricePerKm: tariff.pricePerKm,
      pricePerMin: tariff.pricePerMin,
      minPrice: tariff.minPrice,
      maxPrice: tariff.maxPrice ?? undefined,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    setError(null);
    setSuccess(null);
    try {
      await proposeTariffChange({
        action: editingTariff ? 'update' : 'create',
        tariffId: editingTariff?.id,
        proposedChanges: data,
      });
      setIsModalOpen(false);
      setSuccess('Taklif yuborildi, admin tasdig\'ini kutmoqda');
      await fetchAll();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Taklif yuborib bo\'lmadi';
      setError(message);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F1F5F9]">Tariflar</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">
            O&apos;zgarishlar admin tasdig&apos;idan so&apos;ng kuchga kiradi
          </p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={openProposeNew}>
          Yangi tarif taklif qilish
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-[#10B981]/20 bg-[#10B981]/10 px-4 py-3 text-sm text-[#10B981]">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Amaldagi tariflar</CardTitle>
        </CardHeader>
        {isLoading ? (
          <p className="text-sm text-[#94A3B8]">Yuklanmoqda...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tariffs.map((tariff) => (
              <div
                key={tariff.id}
                className="rounded-lg border border-white/[0.08] p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#F1F5F9]">{tariff.name}</p>
                  <Button variant="ghost" size="sm" onClick={() => openProposeEdit(tariff)}>
                    <Pencil size={14} />
                  </Button>
                </div>
                <div className="text-xs text-[#94A3B8] space-y-1">
                  <p>Boshlang&apos;ich: {tariff.basePrice.toLocaleString()} so&apos;m</p>
                  <p>Km narxi: {tariff.pricePerKm.toLocaleString()} so&apos;m</p>
                  <p>Daqiqa narxi: {tariff.pricePerMin.toLocaleString()} so&apos;m</p>
                  <p>Min narx: {tariff.minPrice.toLocaleString()} so&apos;m</p>
                  <p>Max narx: {tariff.maxPrice ? `${tariff.maxPrice.toLocaleString()} so'm` : 'Cheklanmagan'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mening takliflarim</CardTitle>
        </CardHeader>
        {requests.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">Hali taklif yuborilmagan</p>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.08] px-4 py-2.5"
              >
                <div className="text-sm text-[#F1F5F9]">
                  {req.action === 'create' ? 'Yangi tarif' : 'Tarif yangilash'} —{' '}
                  <span className="text-[#94A3B8]">
                    {new Date(req.createdAt).toLocaleString()}
                  </span>
                </div>
                <Badge variant={statusBadge[req.status].variant}>
                  {statusBadge[req.status].label}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTariff ? `Tarif taklifi: ${editingTariff.name}` : 'Yangi tarif taklifi'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input label="Nomi" {...register('name')} error={errors.name?.message} />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Boshlang'ich narx"
              type="number"
              {...register('basePrice')}
              error={errors.basePrice?.message}
            />
            <Input
              label="Km narxi"
              type="number"
              {...register('pricePerKm')}
              error={errors.pricePerKm?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Daqiqa narxi"
              type="number"
              {...register('pricePerMin')}
              error={errors.pricePerMin?.message}
            />
            <Input
              label="Min narx"
              type="number"
              {...register('minPrice')}
              error={errors.minPrice?.message}
            />
          </div>
          <Input
            label="Max narx (ixtiyoriy)"
            type="number"
            {...register('maxPrice')}
            error={errors.maxPrice?.message}
          />
          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Taklif yuborish
          </Button>
        </form>
      </Modal>
    </div>
  );
}
