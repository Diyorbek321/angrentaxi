'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, CheckCircle2, Pencil, Plus, Tag } from 'lucide-react';
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
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDateTime, formatMoney } from '@/lib/format';

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

function TariffRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

export default function TariffsPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [requests, setRequests] = useState<TariffChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      setLoadError(null);
    } catch {
      setLoadError('Maʼlumotlarni yuklab boʻlmadi');
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
      setSuccess('Taklif yuborildi, admin tasdigʻini kutmoqda');
      await fetchAll();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Taklif yuborib boʻlmadi';
      setError(message);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-5xl mx-auto">
        <PageHeader
          title="Tariflar"
          description="Oʻzgarishlar admin tasdigʻidan soʻng kuchga kiradi"
          icon={<Tag size={17} />}
          actions={
            <Button leftIcon={<Plus size={15} />} onClick={openProposeNew} size="sm">
              Yangi tarif taklif qilish
            </Button>
          }
        />

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/[0.08] px-3.5 py-3 mb-4">
            <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/40 bg-primary/[0.08] px-3.5 py-3 mb-4">
            <CheckCircle2 size={15} className="text-primary-600 dark:text-primary-300 shrink-0 mt-0.5" />
            <p className="text-sm text-primary-700 dark:text-primary-300">{success}</p>
          </div>
        )}

        {loadError ? (
          <ErrorState message={loadError} onRetry={fetchAll} />
        ) : (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Amaldagi tariflar</CardTitle>
                {tariffs.length > 0 && (
                  <Badge variant="mint-soft" size="sm">
                    {tariffs.length}
                  </Badge>
                )}
              </CardHeader>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-44 rounded-xl" />
                  ))}
                </div>
              ) : tariffs.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Tag size={20} />}
                  title="Tarif yoʻq"
                  description="Birinchi tarifni taklif qiling — admin tasdiqlagach kuchga kiradi."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tariffs.map((tariff) => (
                    <div
                      key={tariff.id}
                      className="rounded-xl border border-line bg-surface-2/50 p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-ink truncate">{tariff.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {!tariff.isActive && (
                            <Badge variant="default" size="sm">
                              Faol emas
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openProposeEdit(tariff)}
                            aria-label="Tarifni oʻzgartirishni taklif qilish"
                          >
                            <Pencil size={14} />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs space-y-1">
                        <TariffRow label="Boshlangʻich" value={formatMoney(tariff.basePrice)} />
                        <TariffRow label="Km narxi" value={formatMoney(tariff.pricePerKm)} />
                        <TariffRow label="Daqiqa narxi" value={formatMoney(tariff.pricePerMin)} />
                        <TariffRow label="Min narx" value={formatMoney(tariff.minPrice)} />
                        <TariffRow
                          label="Max narx"
                          value={tariff.maxPrice ? formatMoney(tariff.maxPrice) : 'Cheklanmagan'}
                        />
                      </div>
                      {tariff.surgeMultiplier !== 1 && (
                        <Badge variant="override" size="sm">
                          Oshirilgan ×{tariff.surgeMultiplier}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mening takliflarim</CardTitle>
              </CardHeader>

              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : requests.length === 0 ? (
                <EmptyState
                  compact
                  title="Hali taklif yuborilmagan"
                  description="Tarif kartasidagi qalam belgisi orqali oʻzgarish taklif qiling."
                />
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/50 px-4 py-2.5"
                    >
                      <div className="text-sm text-ink min-w-0">
                        {req.action === 'create' ? 'Yangi tarif' : 'Tarif yangilash'}
                        <span className="text-muted font-mono text-xs ml-2">
                          {formatDateTime(req.createdAt)}
                        </span>
                        {req.reviewNote && (
                          <p className="text-xs text-muted mt-0.5 break-words">{req.reviewNote}</p>
                        )}
                      </div>
                      <Badge variant={statusBadge[req.status].variant} size="sm" dot>
                        {statusBadge[req.status].label}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTariff ? `Tarif taklifi: ${editingTariff.name}` : 'Yangi tarif taklifi'}
        subtitle="Taklif admin tasdigʻiga yuboriladi"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input label="Nomi" {...register('name')} error={errors.name?.message} />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Boshlangʻich narx"
              type="number"
              mono
              {...register('basePrice')}
              error={errors.basePrice?.message}
            />
            <Input
              label="Km narxi"
              type="number"
              mono
              {...register('pricePerKm')}
              error={errors.pricePerKm?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Daqiqa narxi"
              type="number"
              mono
              {...register('pricePerMin')}
              error={errors.pricePerMin?.message}
            />
            <Input
              label="Min narx"
              type="number"
              mono
              {...register('minPrice')}
              error={errors.minPrice?.message}
            />
          </div>
          <Input
            label="Max narx (ixtiyoriy)"
            type="number"
            mono
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
