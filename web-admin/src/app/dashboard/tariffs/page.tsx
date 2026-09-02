'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Flame,
  Tag,
  Check,
  X,
  Inbox,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, BadgeProps } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { Skeleton, SkeletonCards } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  tariffsApi,
  tariffChangeRequestsApi,
  Tariff,
  TariffCreateInput,
  TariffChangeRequest,
} from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

const tariffSchema = z.object({
  name: z.string().min(2, 'Kamida 2 ta harf'),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0, 'Manfiy qiymat bo\'lmasin'),
  pricePerKm: z.coerce.number().min(0, 'Manfiy qiymat bo\'lmasin'),
  pricePerMin: z.coerce.number().min(0, 'Manfiy qiymat bo\'lmasin'),
  minPrice: z.coerce.number().min(0, 'Manfiy qiymat bo\'lmasin'),
  maxPrice: z.coerce.number().min(0, 'Manfiy qiymat bo\'lmasin').optional(),
  isActive: z.boolean().optional(),
});

const actionLabel: Record<TariffChangeRequest['action'], string> = {
  create: 'Yangi',
  update: 'Yangilash',
};

const statusVariant: Record<TariffChangeRequest['status'], NonNullable<BadgeProps['variant']>> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const statusLabel: Record<TariffChangeRequest['status'], string> = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
};

const SURGE_MIN = 1;
const SURGE_MAX = 3;

function validateSurge(raw: string): string | null {
  const value = parseFloat(raw);
  if (Number.isNaN(value) || value < SURGE_MIN || value > SURGE_MAX) {
    return `${SURGE_MIN.toFixed(1)} dan ${SURGE_MAX.toFixed(1)} gacha bo'lishi kerak`;
  }
  return null;
}

type TariffForm = z.infer<typeof tariffSchema>;

/** Narx bloklari — karta ichida takrorlanadigan kichik yacheyka. */
function PriceCell({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn('rounded-ds-xs bg-surface-2 p-2 text-center', wide && 'col-span-2')}>
      <p className="text-caption text-muted">{label}</p>
      <p className="mt-0.5 text-caption font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

export default function TariffsPage() {
  const { toast } = useToast();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tariff | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Inline surge tahriri: bitta maydon — pencil → input + ✓/✕, xato
  // maydonning O'ZIGA biriktiriladi (modal ham, toast ham emas).
  const [editingSurgeId, setEditingSurgeId] = useState<string | null>(null);
  const [surgeValue, setSurgeValue] = useState('');
  const [surgeError, setSurgeError] = useState<string | null>(null);
  const [savingSurgeId, setSavingSurgeId] = useState<string | null>(null);
  const [requests, setRequests] = useState<TariffChangeRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [reviewRequest, setReviewRequest] = useState<TariffChangeRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

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
      setLoadError(null);
    } catch {
      setLoadError('Tariflarni yuklashda xatolik');
      toast({ title: 'Xatolik', description: 'Tariflarni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await tariffChangeRequestsApi.getAll();
      setRequests(res.data.data);
      setRequestsError(null);
    } catch {
      setRequestsError('Takliflarni yuklashda xatolik');
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    fetchTariffs();
    fetchRequests();
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
      maxPrice: undefined,
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
      maxPrice: tariff.maxPrice ?? undefined,
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
        maxPrice: data.maxPrice,
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
      const res = await tariffsApi.toggleActive(tariff.id, !tariff.isActive);
      setTariffs((prev) => prev.map((t) => (t.id === tariff.id ? res.data.data : t)));
      toast({
        title: res.data.data.isActive ? 'Tarif yoqildi' : 'Tarif o\'chirildi',
        variant: 'success',
      });
    } catch {
      toast({ title: 'Xatolik', variant: 'error' });
    }
  };

  const startSurgeEdit = (tariff: Tariff) => {
    setEditingSurgeId(tariff.id);
    setSurgeValue(String(tariff.surgeMultiplier));
    setSurgeError(null);
  };

  const cancelSurgeEdit = () => {
    setEditingSurgeId(null);
    setSurgeValue('');
    setSurgeError(null);
  };

  const applySurge = async (tariff: Tariff) => {
    const validation = validateSurge(surgeValue);
    if (validation) {
      setSurgeError(validation);
      return;
    }
    setSavingSurgeId(tariff.id);
    try {
      const res = await tariffsApi.setSurge(tariff.id, parseFloat(surgeValue));
      setTariffs((prev) => prev.map((t) => (t.id === tariff.id ? res.data.data : t)));
      cancelSurgeEdit();
      toast({ title: 'Narx koeffitsienti yangilandi', variant: 'success' });
    } catch {
      setSurgeError('Saqlashda xatolik — qayta urinib ko\'ring');
    } finally {
      setSavingSurgeId(null);
    }
  };

  const handleReview = async () => {
    if (!reviewRequest || !reviewAction) return;
    setReviewing(true);
    try {
      if (reviewAction === 'approve') {
        await tariffChangeRequestsApi.approve(reviewRequest.id, reviewNote.trim() || undefined);
        toast({ title: 'Taklif tasdiqlandi', variant: 'success' });
      } else {
        await tariffChangeRequestsApi.reject(reviewRequest.id, reviewNote.trim() || undefined);
        toast({ title: 'Taklif rad etildi', variant: 'success' });
      }
      setReviewRequest(null);
      setReviewAction(null);
      setReviewNote('');
      await Promise.all([fetchTariffs(), fetchRequests()]);
    } catch {
      toast({ title: 'Xatolik', description: 'Taklifni ko\'rib chiqishda xatolik', variant: 'error' });
    } finally {
      setReviewing(false);
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

  const activeCount = tariffs.filter((t) => t.isActive).length;
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;

  const renderSurgeBlock = (tariff: Tariff) => {
    const isEditing = editingSurgeId === tariff.id;
    const isSaving = savingSurgeId === tariff.id;
    const errorId = `surge-error-${tariff.id}`;

    return (
      <div
        className={cn(
          'rounded-ds-sm border p-2.5 transition-colors duration-fast',
          // Tahrir rejimidagi maydon ko'rinishidan farq qiladi (doktrina).
          isEditing ? 'border-primary bg-surface' : 'border-line'
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-caption text-muted">
            <Flame
              aria-hidden="true"
              className={cn(
                'h-3.5 w-3.5',
                tariff.surgeMultiplier > 1
                  ? 'text-override-dark dark:text-override-light'
                  : 'text-subtle'
              )}
            />
            Talab koeffitsienti
          </span>
          <Badge variant={tariff.surgeMultiplier > 1 ? 'override' : 'secondary'}>
            {tariff.surgeMultiplier.toFixed(1)}x
          </Badge>
        </div>

        {isEditing ? (
          <div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={SURGE_MIN}
                max={SURGE_MAX}
                step={0.1}
                mono
                autoFocus
                value={surgeValue}
                onChange={(e) => {
                  setSurgeValue(e.target.value);
                  if (surgeError) setSurgeError(validateSurge(e.target.value));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applySurge(tariff);
                  }
                  if (e.key === 'Escape') cancelSurgeEdit();
                }}
                aria-label={`${tariff.name} narx koeffitsienti`}
                aria-invalid={surgeError ? true : undefined}
                aria-describedby={surgeError ? errorId : undefined}
                className="h-8 w-24 px-2 py-1 text-caption"
              />
              {/* Aniq saqlash (✓) va bekor qilish (✕) — yashirin "blur'da
                  saqlanadi" xulq-atvori yo'q. */}
              <Button
                size="icon-sm"
                variant="primary"
                isLoading={isSaving}
                disabled={!!validateSurge(surgeValue)}
                onClick={() => applySurge(tariff)}
                aria-label="Koeffitsientni saqlash"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                disabled={isSaving}
                onClick={cancelSurgeEdit}
                aria-label="Tahrirni bekor qilish"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            {/* Validatsiya xatosi maydonning o'ziga biriktiriladi. */}
            {surgeError ? (
              <p id={errorId} className="mt-1.5 text-caption text-danger-deep dark:text-danger-light">
                {surgeError}
              </p>
            ) : (
              <p className="mt-1.5 text-caption text-subtle">
                {SURGE_MIN.toFixed(1)}–{SURGE_MAX.toFixed(1)} oralig&apos;ida · Enter — saqlash
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => startSurgeEdit(tariff)}
            className={cn(
              'flex w-full items-center justify-between rounded-ds-xs px-2 py-1.5 text-caption font-semibold text-ink',
              'transition-colors duration-fast hover:bg-surface-2',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
            )}
            aria-label={`${tariff.name} narx koeffitsientini tahrirlash`}
          >
            <span className="font-mono tabular-nums">{tariff.surgeMultiplier.toFixed(1)}x</span>
            {/* Ko'rinadigan affordans — operator yacheyka bosib ko'rib
                tahrirlanishini "kashf qilishi" shart emas. */}
            <Pencil className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Tariflar"
        description="Narx siyosatini boshqaring"
        icon={<Tag className="h-4 w-4" />}
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Yangi tarif
          </Button>
        }
      />

      <div className="space-y-6">
        {/* ─── 1-bo'lim: Tariflar ro'yxati ─── */}
        <section aria-labelledby="tariffs-list-heading">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="tariffs-list-heading" className="text-h3 text-ink">
              Tariflar ro&apos;yxati
            </h2>
            {!isLoading && !loadError && tariffs.length > 0 && (
              <p className="text-caption tabular-nums text-muted">
                {tariffs.length} ta tarif · {activeCount} tasi faol
              </p>
            )}
          </div>

          {loadError ? (
            <Card>
              <CardContent className="p-0">
                <ErrorState message={loadError} onRetry={fetchTariffs} />
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-ds-md" />
              ))}
            </div>
          ) : tariffs.length === 0 ? (
            <Card>
              <CardContent className="py-4">
                <EmptyState
                  icon={<Tag className="h-6 w-6" />}
                  title="Tariflar yo'q"
                  description="Narx siyosati birinchi tarifdan boshlanadi."
                  action={<Button onClick={openCreate}>Birinchi tarifni yarating</Button>}
                />
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
                      <p className="mt-1 text-caption text-muted">{tariff.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 pb-4 text-body">
                    {/* Narx tuzilmasi */}
                    <div className="grid grid-cols-2 gap-2">
                      <PriceCell label="Boshlang'ich" value={formatCurrency(tariff.basePrice)} />
                      <PriceCell label="Minimum" value={formatCurrency(tariff.minPrice)} />
                      <PriceCell label="Har km uchun" value={formatCurrency(tariff.pricePerKm)} />
                      <PriceCell label="Har min uchun" value={formatCurrency(tariff.pricePerMin)} />
                      <PriceCell
                        label="Maksimum"
                        value={
                          tariff.maxPrice != null ? formatCurrency(tariff.maxPrice) : 'Cheklanmagan'
                        }
                        wide
                      />
                    </div>

                    {/* Talab koeffitsienti — inline tahrir */}
                    {renderSurgeBlock(tariff)}

                    <p className="mt-1 text-caption tabular-nums text-subtle">
                      Yangilangan: {formatDate(tariff.updatedAt, 'dd.MM.yyyy')}
                    </p>

                    {/* Karta harakatlari */}
                    <div className="flex items-center justify-between border-t border-line pt-2">
                      <button
                        className="flex items-center gap-1.5 rounded-ds-xs text-caption text-muted transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                        onClick={() => handleToggle(tariff)}
                      >
                        {tariff.isActive ? (
                          <ToggleRight className="h-4 w-4 text-primary-text" aria-hidden="true" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-subtle" aria-hidden="true" />
                        )}
                        {tariff.isActive ? 'O\'chirish' : 'Yoqish'}
                      </button>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(tariff)}
                          aria-label={`${tariff.name} tarifini tahrirlash`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="hover:text-danger-deep dark:hover:text-danger-light"
                          onClick={() => setDeleteTarget(tariff)}
                          aria-label={`${tariff.name} tarifini o'chirish`}
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
        </section>

        {/* ─── 2-bo'lim: Boshqaruvchilar takliflari ─── */}
        <section aria-labelledby="tariff-requests-heading">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle id="tariff-requests-heading">Boshqaruvchilar takliflari</CardTitle>
              {pendingRequests > 0 && (
                <Badge variant="warning">{pendingRequests} ta kutilmoqda</Badge>
              )}
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <SkeletonCards count={2} height="h-16" />
              ) : requestsError ? (
                <ErrorState compact message={requestsError} onRetry={fetchRequests} />
              ) : requests.length === 0 ? (
                <EmptyState
                  compact
                  tone="positive"
                  icon={<Inbox className="h-5 w-5" />}
                  title="Hozircha takliflar yo'q"
                  description="Boshqaruvchilar yuborgan takliflar shu yerda ko'rinadi."
                />
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-line px-4 py-3"
                    >
                      <div className="text-body">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{actionLabel[req.action]}</Badge>
                          <span className="text-ink">
                            {(req.proposedChanges as { name?: string }).name ?? 'Tarif'}
                          </span>
                          <Badge variant={statusVariant[req.status]}>{statusLabel[req.status]}</Badge>
                        </div>
                        <p className="mt-1 text-caption tabular-nums text-subtle">
                          {formatDate(req.createdAt, 'dd.MM.yyyy HH:mm')}
                        </p>
                      </div>
                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => {
                              setReviewRequest(req);
                              setReviewAction('approve');
                            }}
                          >
                            Tasdiqlash
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setReviewRequest(req);
                              setReviewAction('reject');
                            }}
                          >
                            Rad etish
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
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
                label="Boshlang'ich narx (so'm)"
                type="number"
                mono
                placeholder="5000"
                error={errors.basePrice?.message}
                {...register('basePrice')}
              />
              <Input
                label="Minimum narx (so'm)"
                type="number"
                mono
                placeholder="8000"
                error={errors.minPrice?.message}
                {...register('minPrice')}
              />
              <Input
                label="1 km narxi (so'm)"
                type="number"
                mono
                placeholder="1500"
                error={errors.pricePerKm?.message}
                {...register('pricePerKm')}
              />
              <Input
                label="1 min narxi (so'm)"
                type="number"
                mono
                placeholder="300"
                error={errors.pricePerMin?.message}
                {...register('pricePerMin')}
              />
              <Input
                label="Maksimal narx (so'm, ixtiyoriy)"
                type="number"
                mono
                placeholder="50000"
                error={errors.maxPrice?.message}
                {...register('maxPrice')}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-body font-medium text-muted">
              <input
                type="checkbox"
                className="rounded accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                {...register('isActive')}
              />
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
          <p className="text-body text-muted">
            <strong className="text-ink">{deleteTarget?.name}</strong> tarifini o&apos;chirmoqchimisiz?
            Bu amalni bekor qilib bo&apos;lmaydi.
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

      {/* Tariff change request review modal */}
      <Dialog
        open={!!reviewRequest}
        onOpenChange={() => {
          setReviewRequest(null);
          setReviewAction(null);
          setReviewNote('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Taklifni tasdiqlash' : 'Taklifni rad etish'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve'
                ? 'Ushbu taklifni tasdiqlasangiz, o\'zgarishlar darhol tariflarga qo\'llaniladi.'
                : 'Ushbu taklifni rad etmoqchimisiz?'}
            </DialogDescription>
          </DialogHeader>
          <Input
            label="Izoh (ixtiyoriy)"
            placeholder="Sababini yozing..."
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setReviewRequest(null);
                setReviewAction(null);
                setReviewNote('');
              }}
            >
              Bekor qilish
            </Button>
            <Button
              variant={reviewAction === 'approve' ? 'success' : 'destructive'}
              isLoading={reviewing}
              onClick={handleReview}
            >
              {reviewAction === 'approve' ? 'Tasdiqlash' : 'Rad etish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
