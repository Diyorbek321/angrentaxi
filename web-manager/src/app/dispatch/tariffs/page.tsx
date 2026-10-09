'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Clock, Pencil, Plus, RefreshCw, Tag } from 'lucide-react';
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
import { RetryBanner } from '@/components/ui/RetryBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatMoney } from '@/lib/format';
import { meteredPriceField, meteredPriceLabel } from '@/lib/metered-price';

// Every message is Uzbek and attaches to its own field — a form that reports
// "Expected number" in English is a form the operator cannot fix.
const schema = z
  .object({
    name: z.string().min(2, 'Nomi kamida 2 ta belgi boʻlsin'),
    basePrice: z.coerce.number({ invalid_type_error: 'Raqam kiriting' }).min(0, 'Manfiy boʻlmasin'),
    pricePerKm: z.coerce.number({ invalid_type_error: 'Raqam kiriting' }).min(0, 'Manfiy boʻlmasin'),
    meteredPricePerKm: meteredPriceField,
    pricePerMin: z.coerce
      .number({ invalid_type_error: 'Raqam kiriting' })
      .min(0, 'Manfiy boʻlmasin'),
    minPrice: z.coerce.number({ invalid_type_error: 'Raqam kiriting' }).min(0, 'Manfiy boʻlmasin'),
    maxPrice: z.coerce.number({ invalid_type_error: 'Raqam kiriting' }).min(0).optional(),
  })
  .refine((data) => data.maxPrice == null || data.maxPrice === 0 || data.maxPrice >= data.minPrice, {
    message: 'Max narx min narxdan kichik boʻlmasligi kerak',
    path: ['maxPrice'],
  });

type FormData = z.infer<typeof schema>;

const statusBadge: Record<TariffChangeRequest['status'], { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Kutilmoqda', variant: 'info' },
  approved: { label: 'Tasdiqlangan', variant: 'success' },
  rejected: { label: 'Rad etilgan', variant: 'danger' },
};

function TariffRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-ink tabular-nums">{value}</span>
    </div>
  );
}

export default function TariffsPage() {
  const { toast } = useToast();

  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [requests, setRequests] = useState<TariffChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      setLoadError('Maʼlumotlarni yuklab boʻlmadi.');
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openProposeNew = () => {
    setEditingTariff(null);
    setSubmitError(null);
    reset({
      name: '',
      basePrice: 0,
      pricePerKm: 0,
      meteredPricePerKm: null,
      pricePerMin: 0,
      minPrice: 0,
      maxPrice: undefined,
    });
    setIsModalOpen(true);
  };

  const openProposeEdit = (tariff: Tariff) => {
    setEditingTariff(tariff);
    setSubmitError(null);
    reset({
      name: tariff.name,
      basePrice: tariff.basePrice,
      pricePerKm: tariff.pricePerKm,
      meteredPricePerKm: tariff.meteredPricePerKm,
      pricePerMin: tariff.pricePerMin,
      minPrice: tariff.minPrice,
      maxPrice: tariff.maxPrice ?? undefined,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      await proposeTariffChange({
        action: editingTariff ? 'update' : 'create',
        tariffId: editingTariff?.id,
        // An empty "Max narx (ixtiyoriy)" coerces to 0, which the schema above
        // reads as "no cap" — send it as null, not as a cap of 0 so'm (which the
        // server rejects, since it is below the minimum price).
        proposedChanges: { ...data, maxPrice: data.maxPrice ? data.maxPrice : null },
      });
      setIsModalOpen(false);
      toast({
        title: editingTariff
          ? `«${editingTariff.name}» oʻzgarishi taklif qilindi`
          : `«${data.name}» tarifi taklif qilindi`,
        description: 'Admin tasdigʻidan soʻng kuchga kiradi.',
        variant: 'success',
      });
      await fetchAll();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Taklif yuborib boʻlmadi';
      // Stays inside the modal, next to the form that produced it — the
      // operator's input is still on screen and still editable.
      setSubmitError(message);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const showSkeleton = isLoading && !hasLoadedOnce;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-5xl mx-auto">
        <PageHeader
          title="Tariflar"
          description="Oʻzgarishlar admin tasdigʻidan soʻng kuchga kiradi"
          icon={<Tag size={17} />}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchAll}
                leftIcon={<RefreshCw size={13} />}
              >
                Yangilash
              </Button>
              <Button leftIcon={<Plus size={15} />} onClick={openProposeNew} size="sm">
                Yangi tarif taklif qilish
              </Button>
            </>
          }
        />

        {loadError && (
          <RetryBanner
            message={loadError}
            onRetry={fetchAll}
            keepsLastData={tariffs.length > 0 || requests.length > 0}
            className="mb-4"
          />
        )}

        {loadError && !hasLoadedOnce ? (
          <ErrorState message="Tarmoq yoki server xatosi. Qayta urinib koʻring." onRetry={fetchAll} />
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

              {showSkeleton ? (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  aria-busy="true"
                >
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-44 rounded-ds-sm" />
                  ))}
                </div>
              ) : tariffs.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Tag size={20} />}
                  title="Tarif yoʻq"
                  description="Birinchi tarifni taklif qiling — admin tasdiqlagach kuchga kiradi."
                  action={
                    <Button size="sm" leftIcon={<Plus size={14} />} onClick={openProposeNew}>
                      Yangi tarif taklif qilish
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tariffs.map((tariff) => (
                    <div
                      key={tariff.id}
                      className="rounded-ds-sm border border-line bg-surface-2/50 p-4 space-y-2.5"
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
                            aria-label={`${tariff.name} tarifini oʻzgartirishni taklif qilish`}
                          >
                            <Pencil size={14} />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs space-y-1">
                        <TariffRow label="Boshlangʻich" value={formatMoney(tariff.basePrice)} />
                        <TariffRow label="Km narxi" value={formatMoney(tariff.pricePerKm)} />
                        <TariffRow
                          label="Taksometr km"
                          value={meteredPriceLabel(tariff.meteredPricePerKm, formatMoney)}
                        />
                        <TariffRow label="Daqiqa narxi" value={formatMoney(tariff.pricePerMin)} />
                        <TariffRow label="Min narx" value={formatMoney(tariff.minPrice)} />
                        <TariffRow
                          label="Max narx"
                          value={tariff.maxPrice ? formatMoney(tariff.maxPrice) : 'Cheklanmagan'}
                        />
                      </div>
                      {tariff.surgeMultiplier !== 1 && (
                        <Badge variant="info" size="sm">
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
                {/* Pending count is the number the operator is waiting on. */}
                {pendingRequests.length > 0 && (
                  <Badge variant="info" size="sm" dot>
                    <Clock size={11} aria-hidden />
                    {pendingRequests.length} ta kutilmoqda
                  </Badge>
                )}
              </CardHeader>

              {showSkeleton ? (
                <div className="space-y-2" aria-busy="true">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : requests.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Tag size={20} />}
                  title="Hali taklif yuborilmagan"
                  description="Tarif kartasidagi qalam belgisi orqali oʻzgarish taklif qiling."
                />
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-3 rounded-ds-xs border border-line bg-surface-2/50 px-4 py-2.5"
                    >
                      <div className="text-sm text-ink min-w-0">
                        {req.action === 'create' ? 'Yangi tarif' : 'Tarif yangilash'}
                        <span className="text-muted font-mono text-xs ml-2 tabular-nums">
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
          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-ds-xs border border-danger/40 bg-danger-tint px-3.5 py-3"
            >
              <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-danger-deep dark:text-danger-light">{submitError}</p>
            </div>
          )}

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
            label="Taksometr km narxi (ixtiyoriy)"
            type="number"
            mono
            hint="Manzilsiz safar uchun, odatda km narxidan biroz qimmat. Boʻsh — oddiy km narxi"
            {...register('meteredPricePerKm')}
            error={errors.meteredPricePerKm?.message}
          />
          <Input
            label="Max narx (ixtiyoriy)"
            type="number"
            mono
            hint="Boʻsh qoldirilsa narx cheklanmaydi"
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
