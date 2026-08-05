'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Flame, Tag } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/Skeleton';
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
import { formatCurrency, formatDate } from '@/lib/utils';

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

type TariffForm = z.infer<typeof tariffSchema>;

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
  const [surgeInputs, setSurgeInputs] = useState<Record<string, string>>({});
  const [savingSurgeId, setSavingSurgeId] = useState<string | null>(null);
  const [requests, setRequests] = useState<TariffChangeRequest[]>([]);
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
    try {
      const res = await tariffChangeRequestsApi.getAll();
      setRequests(res.data.data);
    } catch {
      toast({ title: 'Xatolik', description: 'Takliflarni yuklashda xatolik', variant: 'error' });
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

  const handleSetSurge = async (tariff: Tariff) => {
    const raw = surgeInputs[tariff.id];
    const multiplier = raw !== undefined ? parseFloat(raw) : tariff.surgeMultiplier;

    if (Number.isNaN(multiplier) || multiplier < 1 || multiplier > 3) {
      toast({ title: 'Xatolik', description: 'Koeffitsient 1.0 dan 3.0 gacha bo\'lishi kerak', variant: 'error' });
      return;
    }

    setSavingSurgeId(tariff.id);
    try {
      const res = await tariffsApi.setSurge(tariff.id, multiplier);
      setTariffs((prev) => prev.map((t) => (t.id === tariff.id ? res.data.data : t)));
      setSurgeInputs((prev) => ({ ...prev, [tariff.id]: String(res.data.data.surgeMultiplier) }));
      toast({ title: 'Narx koeffitsienti yangilandi', variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', description: 'Koeffitsientni saqlashda xatolik', variant: 'error' });
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

      <div className="space-y-4">
        {loadError ? (
          <ErrorState message={loadError} onRetry={fetchTariffs} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : tariffs.length === 0 ? (
          <Card>
            <CardContent className="py-4">
              <EmptyState
                icon={<Tag className="h-6 w-6" />}
                title="Tariflar yo'q"
                description="Birinchi tarifni yarating."
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
                    <p className="text-caption text-muted mt-1">{tariff.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-body pb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-ds-xs bg-surface-2 p-2 text-center">
                      <p className="text-caption text-muted">Boshlang&apos;ich</p>
                      <p className="font-semibold text-ink text-caption mt-0.5">
                        {formatCurrency(tariff.basePrice)}
                      </p>
                    </div>
                    <div className="rounded-ds-xs bg-surface-2 p-2 text-center">
                      <p className="text-caption text-muted">Minimum</p>
                      <p className="font-semibold text-ink text-caption mt-0.5">
                        {formatCurrency(tariff.minPrice)}
                      </p>
                    </div>
                    <div className="rounded-ds-xs bg-surface-2 p-2 text-center">
                      <p className="text-caption text-muted">Har km uchun</p>
                      <p className="font-semibold text-ink text-caption mt-0.5">
                        {formatCurrency(tariff.pricePerKm)}
                      </p>
                    </div>
                    <div className="rounded-ds-xs bg-surface-2 p-2 text-center">
                      <p className="text-caption text-muted">Har min uchun</p>
                      <p className="font-semibold text-ink text-caption mt-0.5">
                        {formatCurrency(tariff.pricePerMin)}
                      </p>
                    </div>
                    <div className="rounded-ds-xs bg-surface-2 p-2 text-center col-span-2">
                      <p className="text-caption text-muted">Maksimum</p>
                      <p className="font-semibold text-ink text-caption mt-0.5">
                        {tariff.maxPrice != null ? formatCurrency(tariff.maxPrice) : 'Cheklanmagan'}
                      </p>
                    </div>
                  </div>

                  {/* Surge multiplier control */}
                  <div className="rounded-ds-sm border border-line p-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-caption text-muted">
                        <Flame
                          aria-hidden="true"
                          className={`h-3.5 w-3.5 ${
                            tariff.surgeMultiplier > 1
                              ? 'text-override-dark dark:text-override-light'
                              : 'text-subtle'
                          }`}
                        />
                        Talab koeffitsienti
                      </span>
                      <Badge variant={tariff.surgeMultiplier > 1 ? 'override' : 'secondary'}>
                        {tariff.surgeMultiplier.toFixed(1)}x
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={3}
                        step={0.1}
                        value={surgeInputs[tariff.id] ?? String(tariff.surgeMultiplier)}
                        onChange={(e) =>
                          setSurgeInputs((prev) => ({ ...prev, [tariff.id]: e.target.value }))
                        }
                        className="h-8 w-20 px-2 py-1 text-caption"
                        aria-label={`${tariff.name} narx koeffitsienti`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={savingSurgeId === tariff.id}
                        onClick={() => handleSetSurge(tariff)}
                      >
                        Qo&apos;llash
                      </Button>
                    </div>
                  </div>

                  <p className="text-caption text-subtle mt-1">
                    Yangilangan: {formatDate(tariff.updatedAt, 'dd.MM.yyyy')}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-line">
                    <button
                      className="flex items-center gap-1.5 text-caption text-muted hover:text-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-ds-xs"
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

        {/* Manager-proposed tariff changes awaiting review */}
        <Card>
          <CardHeader>
            <CardTitle>Takliflar</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <EmptyState
                compact
                tone="positive"
                title="Hozircha takliflar yo'q"
                description="Boshqaruvchilar yuborgan takliflar shu yerda ko'rinadi."
              />
            ) : (
              <div className="space-y-2">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between rounded-ds-sm border border-line px-4 py-3"
                  >
                    <div className="text-body">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{actionLabel[req.action]}</Badge>
                        <span className="text-ink">
                          {(req.proposedChanges as { name?: string }).name ?? 'Tarif'}
                        </span>
                        <Badge variant={statusVariant[req.status]}>{statusLabel[req.status]}</Badge>
                      </div>
                      <p className="text-caption text-subtle mt-1">
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
                mono
                placeholder="5000"
                error={errors.basePrice?.message}
                {...register('basePrice')}
              />
              <Input
                label="Minimum narx (UZS)"
                type="number"
                mono
                placeholder="8000"
                error={errors.minPrice?.message}
                {...register('minPrice')}
              />
              <Input
                label="1 km narxi (UZS)"
                type="number"
                mono
                placeholder="1500"
                error={errors.pricePerKm?.message}
                {...register('pricePerKm')}
              />
              <Input
                label="1 min narxi (UZS)"
                type="number"
                mono
                placeholder="300"
                error={errors.pricePerMin?.message}
                {...register('pricePerMin')}
              />
              <Input
                label="Maksimal narx (UZS, ixtiyoriy)"
                type="number"
                mono
                placeholder="50000"
                error={errors.maxPrice?.message}
                {...register('maxPrice')}
              />
            </div>
            <label className="flex items-center gap-2 text-body font-medium text-muted cursor-pointer">
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
