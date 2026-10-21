'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { t } from '@/locales';

// Every message is Uzbek and attaches to its own field — a form that reports
// "Expected number" in English is a form the operator cannot fix.
// Built at call time so messages follow the active language.
function buildSchema() {
  const v = t().ops.tariffs.validation;
  return z
    .object({
      name: z.string().min(2, v.nameMin),
      basePrice: z.coerce.number({ invalid_type_error: v.number }).min(0, v.nonNegative),
      pricePerKm: z.coerce.number({ invalid_type_error: v.number }).min(0, v.nonNegative),
      meteredPricePerKm: meteredPriceField(),
      pricePerMin: z.coerce.number({ invalid_type_error: v.number }).min(0, v.nonNegative),
      minPrice: z.coerce.number({ invalid_type_error: v.number }).min(0, v.nonNegative),
      maxPrice: z.coerce.number({ invalid_type_error: v.number }).min(0).optional(),
    })
    .refine((data) => data.maxPrice == null || data.maxPrice === 0 || data.maxPrice >= data.minPrice, {
      message: v.maxBelowMin,
      path: ['maxPrice'],
    });
}

type FormData = z.infer<ReturnType<typeof buildSchema>>;

function statusBadges(): Record<TariffChangeRequest['status'], { label: string; variant: BadgeVariant }> {
  const s = t().ops.tariffs.requestStatus;
  return {
    pending: { label: s.pending, variant: 'info' },
    approved: { label: s.approved, variant: 'success' },
    rejected: { label: s.rejected, variant: 'danger' },
  };
}

function TariffRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="num text-ink">{value}</dd>
    </div>
  );
}

export default function TariffsPage() {
  const m = t();
  const tm = m.ops.tariffs;
  const { toast } = useToast();
  const schema = useMemo(() => buildSchema(), []);
  const statusBadge = statusBadges();

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
      setLoadError(t().ops.tariffs.loadFailed);
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
          ? tm.changeProposed(editingTariff.name)
          : tm.tariffProposed(data.name),
        description: tm.proposedDescription,
        variant: 'success',
      });
      await fetchAll();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        tm.submitFailed;
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
          title={tm.title}
          description={tm.description}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchAll}
                isLoading={isLoading && hasLoadedOnce}
                leftIcon={<RefreshCw size={13} aria-hidden />}
              >
                {m.common.refresh}
              </Button>
              <Button leftIcon={<Plus size={14} aria-hidden />} onClick={openProposeNew} size="sm">
                {tm.proposeNew}
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
              message={tm.networkError}
              onRetry={fetchAll}
              retrying={isLoading}
            />
          </Card>
        ) : (
          <div className="space-y-5">
            <Card padding="none">
              <CardHeader
                title={tm.currentTitle}
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
                  title={tm.emptyTitle}
                  description={tm.emptyDescription}
                  action={
                    <Button size="sm" leftIcon={<Plus size={14} aria-hidden />} onClick={openProposeNew}>
                      {tm.proposeNew}
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
                              {tm.inactive}
                            </Badge>
                          )}
                          <IconButton
                            size="sm"
                            onClick={() => openProposeEdit(tariff)}
                            aria-label={tm.proposeEditAria(tariff.name)}
                          >
                            <Pencil aria-hidden />
                          </IconButton>
                        </div>
                      </div>
                      <dl className="text-[13px] space-y-1">
                        <TariffRow label={tm.base} value={<MoneyText value={tariff.basePrice} />} />
                        <TariffRow label={tm.perKm} value={<MoneyText value={tariff.pricePerKm} />} />
                        <TariffRow
                          label={tm.meteredKm}
                          value={meteredPriceLabel(tariff.meteredPricePerKm, formatMoney)}
                        />
                        <TariffRow label={tm.perMin} value={<MoneyText value={tariff.pricePerMin} />} />
                        <TariffRow label={tm.minPrice} value={<MoneyText value={tariff.minPrice} />} />
                        <TariffRow
                          label={tm.maxPrice}
                          value={tariff.maxPrice ? <MoneyText value={tariff.maxPrice} /> : tm.unlimited}
                        />
                      </dl>
                      {tariff.surgeMultiplier !== 1 && (
                        <Badge variant="info" size="sm">
                          {tm.surge(tariff.surgeMultiplier)}
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
                title={tm.myRequests}
                actions={
                  pendingRequests.length > 0 ? (
                    <Badge variant="info" size="sm" dot>
                      {tm.pendingCount(pendingRequests.length)}
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
                  title={tm.noRequestsTitle}
                  description={tm.noRequestsDescription}
                />
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-3 rounded-ds-sm border border-line px-3 py-2"
                    >
                      <div className="text-[13px] text-ink min-w-0">
                        {req.action === 'create' ? tm.actionCreate : tm.actionUpdate}
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
        title={editingTariff ? tm.modalEditTitle(editingTariff.name) : tm.modalNewTitle}
        subtitle={tm.modalSubtitle}
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

          <Input label={tm.fields.name} {...register('name')} error={errors.name?.message} />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={tm.fields.basePrice}
              type="number"
              {...register('basePrice')}
              error={errors.basePrice?.message}
            />
            <Input
              label={tm.perKm}
              type="number"
              {...register('pricePerKm')}
              error={errors.pricePerKm?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={tm.perMin}
              type="number"
              {...register('pricePerMin')}
              error={errors.pricePerMin?.message}
            />
            <Input
              label={tm.minPrice}
              type="number"
              {...register('minPrice')}
              error={errors.minPrice?.message}
            />
          </div>
          <Input
            label={tm.fields.meteredPrice}
            type="number"
            hint={tm.fields.meteredHint}
            {...register('meteredPricePerKm')}
            error={errors.meteredPricePerKm?.message}
          />
          <Input
            label={tm.fields.maxPrice}
            type="number"
            hint={tm.fields.maxHint}
            {...register('maxPrice')}
            error={errors.maxPrice?.message}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              {m.common.cancel}
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {tm.submit}
            </Button>
          </div>
        </form>
      </Modal>
    </PageBody>
  );
}
