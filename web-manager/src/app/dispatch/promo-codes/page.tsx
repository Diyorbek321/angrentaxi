'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Plus, Tag } from 'lucide-react';
import { getPromoCodes, createPromoCode, PromoCode } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';

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
  const [loadError, setLoadError] = useState<string | null>(null);

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
      setLoadError(null);
    } catch {
      setLoadError('Promo kodlarni yuklab boʻlmadi');
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
        'Promo kod yaratib boʻlmadi';
      setError(message);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-5xl mx-auto">
        <PageHeader
          title="Promo kodlar"
          description="Chegirma kodlarini yaratish va boshqarish"
          icon={<Tag size={17} />}
          actions={
            <Button leftIcon={<Plus size={15} />} onClick={() => setIsModalOpen(true)} size="sm">
              Yangi promo kod
            </Button>
          }
        />

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/[0.08] px-3.5 py-3 mb-4">
            <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <Card padding={isLoading || promoCodes.length === 0 ? 'md' : 'none'}>
          {!isLoading && promoCodes.length > 0 && (
            <div className="px-4 py-3 border-b border-line">
              <CardTitle>Barcha promo kodlar</CardTitle>
            </div>
          )}

          {loadError ? (
            <ErrorState compact message={loadError} onRetry={fetchPromoCodes} />
          ) : isLoading ? (
            <>
              <CardHeader>
                <CardTitle>Barcha promo kodlar</CardTitle>
              </CardHeader>
              <SkeletonTable rows={5} cols={6} />
            </>
          ) : promoCodes.length === 0 ? (
            <>
              <CardHeader>
                <CardTitle>Barcha promo kodlar</CardTitle>
              </CardHeader>
              <EmptyState
                icon={<Tag size={22} />}
                title="Hali promo kod yaratilmagan"
                description="Birinchi chegirma kodini yarating."
                action={
                  <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setIsModalOpen(true)}>
                    Yangi promo kod
                  </Button>
                }
              />
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 text-subtle uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Kod</th>
                    <th className="px-4 py-3 font-semibold">Chegirma</th>
                    <th className="px-4 py-3 font-semibold">Ishlatilgan</th>
                    <th className="px-4 py-3 font-semibold">Min. summa</th>
                    <th className="px-4 py-3 font-semibold">Muddati</th>
                    <th className="px-4 py-3 font-semibold">Holati</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {promoCodes.map((promo) => (
                    <tr key={promo.id} className="hover:bg-surface-2/70 transition-colors">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 font-mono font-semibold text-ink">
                          <Tag size={13} className="text-primary shrink-0" />
                          {promo.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-ink whitespace-nowrap">
                        {promo.discountPercent != null
                          ? `${promo.discountPercent}%`
                          : formatMoney(promo.discountFixed)}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted">
                        {formatNumber(promo.usedCount)}
                        {promo.maxUses != null ? ` / ${formatNumber(promo.maxUses)}` : ''}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted whitespace-nowrap">
                        {formatMoney(promo.minOrderAmount)}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                        {promo.expiresAt ? formatDate(promo.expiresAt) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={promo.isActive ? 'success' : 'default'} size="sm" dot>
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
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Yangi promo kod">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="Kod"
            placeholder="ANGREN10"
            mono
            {...register('code')}
            error={errors.code?.message}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Chegirma (%)"
              type="number"
              placeholder="10"
              mono
              {...register('discountPercent')}
              error={errors.discountPercent?.message}
            />
            <Input
              label="Chegirma (soʻm)"
              type="number"
              placeholder="5000"
              mono
              {...register('discountFixed')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Max ishlatish soni"
              type="number"
              placeholder="100"
              mono
              {...register('maxUses')}
            />
            <Input
              label="Min buyurtma summasi"
              type="number"
              placeholder="0"
              mono
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
