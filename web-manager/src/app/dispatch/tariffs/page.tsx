'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Pencil, Plus, RefreshCw, Tag } from 'lucide-react';
import {
  getTariffs,
  getTariffChangeRequests,
  proposeTariffChange,
  Tariff,
  TariffChangeRequest,
} from '@/lib/api';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageBody } from '@/components/ui/PageBody';
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
import { TripOptionFeesCard } from '@/components/tariffs/TripOptionFeesCard';
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

function TariffRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="num text-ink">{value}</dd>
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
    <PageBody className="max-w-5xl">
        <PageHeader
          title="Tariflar"
          description="Oʻzgarishlar admin tasdigʻidan soʻng kuchga kiradi"
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchAll}
                isLoading={isLoading && hasLoadedOnce}
                leftIcon={<RefreshCw size={13} aria-hidden />}
              >
                Yangilash
              </Button>
              <Button leftIcon={<Plus size={14} aria-hidden />} onClick={openProposeNew} size="sm">
                Yangi tarif taklif qilish
              </Button>
            </>
          }
        />

        {loadError && hasLoadedOnce && (
          <RetryBanner message={loadError} onRetry={fetchAll} keepsLastData className="mb-4" />
        )}

        {loadError && !hasLoadedOnce ? (
          <Card padding="none">
            <ErrorState
              title={loadError}
              message="Tarmoq yoki server xatosi. Qayta urinib koʻring."
              onRetry={fetchAll}
              retrying={isLoading}
            />
          </Card>
        ) : (
          <div className="space-y-5">
            <Card padding="none">
              <CardHeader
                title="Amaldagi tariflar"
                actions={
                  tariffs.length > 0 ? (
                    <Badge variant="neutral" size="sm">
                      {tariffs.length}
                    </Badge>
                  ) : undefined
                }
              />
              <CardBody>

              {showSkeleton ? (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  aria-busy="true"
                >
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-48 rounded-ds-md" />
                  ))}
                </div>
              ) : tariffs.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Tag aria-hidden />}
                  title="Tarif yoʻq"
                  description="Birinchi tarifni taklif qiling — admin tasdiqlagach kuchga kiradi."
                  action={
                    <Button size="sm" leftIcon={<Plus size={14} aria-hidden />} onClick={openProposeNew}>
                      Yangi tarif taklif qilish
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tariffs.map((tariff) => (
                    <div
                      key={tariff.id}
                      className="rounded-ds-md border border-line bg-surface-2/50 p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-title text-ink truncate">{tariff.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {!tariff.isActive && (
                            <Badge variant="neutral" size="sm">
                              Faol emas
                            </Badge>
                          )}
                          <IconButton
                            size="sm"
                            onClick={() => openProposeEdit(tariff)}
                            aria-label={`${tariff.name} tarifini oʻzgartirishni taklif qilish`}
                          >
                            <Pencil aria-hidden />
                          </IconButton>
                        </div>
                      </div>
                      <dl className="text-[13px] space-y-1">
                        <TariffRow label="Boshlangʻich" value={<MoneyText value={tariff.basePrice} />} />
                        <TariffRow label="Km narxi" value={<MoneyText value={tariff.pricePerKm} />} />
                        <TariffRow
                          label="Taksometr km"
                          value={meteredPriceLabel(tariff.meteredPricePerKm, formatMoney)}
                        />
                        <TariffRow label="Daqiqa narxi" value={<MoneyText value={tariff.pricePerMin} />} />
                        <TariffRow label="Min narx" value={<MoneyText value={tariff.minPrice} />} />
                        <TariffRow
                          label="Max narx"
                          value={tariff.maxPrice ? <MoneyText value={tariff.maxPrice} /> : 'Cheklanmagan'}
                        />
                      </dl>
                      {tariff.surgeMultiplier !== 1 && (
                        <Badge variant="info" size="sm">
                          Oshirilgan ×{tariff.surgeMultiplier}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </CardBody>
            </Card>

            <TripOptionFeesCard />

            <Card padding="none">
              {/* Pending count is the number the operator is waiting on. */}
              <CardHeader
                title="Mening takliflarim"
                actions={
                  pendingRequests.length > 0 ? (
                    <Badge variant="info" size="sm" dot>
                      {pendingRequests.length} ta kutilmoqda
                    </Badge>
                  ) : undefined
                }
              />
              <CardBody>

              {showSkeleton ? (
                <div className="space-y-2" aria-busy="true">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : requests.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Tag aria-hidden />}
                  title="Hali taklif yuborilmagan"
                  description="Tarif kartasidagi qalam belgisi orqali oʻzgarish taklif qiling."
                />
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-3 rounded-ds-sm border border-line px-3 py-2"
                    >
                      <div className="text-[13px] text-ink min-w-0">
                        {req.action === 'create' ? 'Yangi tarif' : 'Tarif yangilash'}
                        <span className="num text-muted text-xs ml-2">
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
              </CardBody>
            </Card>
          </div>
        )}

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
              className="flex items-start gap-2.5 rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2"
            >
              <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" aria-hidden />
              <p className="text-[13px] text-danger-dark dark:text-danger-light">{submitError}</p>
            </div>
          )}

          <Input label="Nomi" {...register('name')} error={errors.name?.message} />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Boshlangʻich narx"
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
            label="Taksometr km narxi (ixtiyoriy)"
            type="number"
            hint="Manzilsiz safar uchun, odatda km narxidan biroz qimmat. Boʻsh — oddiy km narxi"
            {...register('meteredPricePerKm')}
            error={errors.meteredPricePerKm?.message}
          />
          <Input
            label="Max narx (ixtiyoriy)"
            type="number"
            hint="Boʻsh qoldirilsa narx cheklanmaydi"
            {...register('maxPrice')}
            error={errors.maxPrice?.message}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Taklif yuborish
            </Button>
          </div>
        </form>
      </Modal>
    </PageBody>
  );
}
