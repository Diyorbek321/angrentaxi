'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Tag } from 'lucide-react';
import { getPromoCodes, createPromoCode, PromoCode } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const schema = z
  .object({
    code: z.string().min(3, 'Kamida 3 ta belgi').max(50),
    discountPercent: z.string().optional(),
    discountFixed: z.string().optional(),
    maxUses: z.string().optional(),
    minOrderAmount: z.string().optional(),
    expiresAt: z.string().optional(),
  })
  .refine((data) => data.discountPercent || data.discountFixed, {
    message: 'Foiz yoki summa chegirmasidan birini kiriting',
    path: ['discountPercent'],
  });

type FormData = z.infer<typeof schema>;

export default function PromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const fetchPromoCodes = async () => {
    setIsLoading(true);
    try {
      const data = await getPromoCodes();
      setPromoCodes(data);
    } catch {
      setError('Promo kodlarni yuklab bo\'lmadi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await createPromoCode({
        code: data.code.toUpperCase(),
        discountPercent: data.discountPercent ? Number(data.discountPercent) : undefined,
        discountFixed: data.discountFixed ? Number(data.discountFixed) : undefined,
        maxUses: data.maxUses ? Number(data.maxUses) : undefined,
        minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : undefined,
        expiresAt: data.expiresAt || undefined,
      });
      reset();
      setIsModalOpen(false);
      await fetchPromoCodes();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Promo kod yaratib bo\'lmadi';
      setError(message);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F1F5F9]">Promo kodlar</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">Chegirma kodlarini yaratish va boshqarish</p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setIsModalOpen(true)}>
          Yangi promo kod
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Barcha promo kodlar</CardTitle>
        </CardHeader>
        {isLoading ? (
          <p className="text-sm text-[#94A3B8]">Yuklanmoqda...</p>
        ) : promoCodes.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">Hali promo kod yaratilmagan</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#94A3B8] border-b border-white/[0.08]">
                  <th className="pb-2 pr-4 font-medium">Kod</th>
                  <th className="pb-2 pr-4 font-medium">Chegirma</th>
                  <th className="pb-2 pr-4 font-medium">Ishlatilgan</th>
                  <th className="pb-2 pr-4 font-medium">Min. summa</th>
                  <th className="pb-2 pr-4 font-medium">Muddati</th>
                  <th className="pb-2 font-medium">Holati</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((promo) => (
                  <tr key={promo.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2.5 pr-4 font-mono text-[#F1F5F9] flex items-center gap-1.5">
                      <Tag size={13} className="text-[#94A3B8]" />
                      {promo.code}
                    </td>
                    <td className="py-2.5 pr-4 text-[#F1F5F9]">
                      {promo.discountPercent != null
                        ? `${promo.discountPercent}%`
                        : `${promo.discountFixed?.toLocaleString()} so'm`}
                    </td>
                    <td className="py-2.5 pr-4 text-[#94A3B8]">
                      {promo.usedCount}
                      {promo.maxUses != null ? ` / ${promo.maxUses}` : ''}
                    </td>
                    <td className="py-2.5 pr-4 text-[#94A3B8]">
                      {promo.minOrderAmount.toLocaleString()} so'm
                    </td>
                    <td className="py-2.5 pr-4 text-[#94A3B8]">
                      {promo.expiresAt ? new Date(promo.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2.5">
                      <Badge variant={promo.isActive ? 'success' : 'default'}>
                        {promo.isActive ? 'Faol' : 'Faol emas'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Yangi promo kod"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="Kod"
            placeholder="ANGREN10"
            {...register('code')}
            error={errors.code?.message}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Chegirma (%)"
              type="number"
              placeholder="10"
              {...register('discountPercent')}
              error={errors.discountPercent?.message}
            />
            <Input
              label="Chegirma (so'm)"
              type="number"
              placeholder="5000"
              {...register('discountFixed')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Max ishlatish soni"
              type="number"
              placeholder="100"
              {...register('maxUses')}
            />
            <Input
              label="Min buyurtma summasi"
              type="number"
              placeholder="0"
              {...register('minOrderAmount')}
            />
          </div>
          <Input label="Amal qilish muddati" type="date" {...register('expiresAt')} />
          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Yaratish
          </Button>
        </form>
      </Modal>
    </div>
  );
}
