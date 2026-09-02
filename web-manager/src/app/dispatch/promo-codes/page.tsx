'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Download, Plus, RefreshCw, Search, Tag } from 'lucide-react';
import { getPromoCodes, createPromoCode, PromoCode } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChip } from '@/components/ui/FilterChip';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';

const optionalNumber = (label: string, max?: number) =>
  z
    .string()
    .optional()
    .refine(
      (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0 && (max == null || Number(v) <= max)),
      { message: label }
    );

const schema = z
  .object({
    code: z
      .string()
      .min(3, 'Kamida 3 ta belgi')
      .max(50, 'Koʻpi bilan 50 ta belgi')
      .regex(/^[A-Za-z0-9_-]+$/, 'Faqat harf, raqam, - va _'),
    discountPercent: optionalNumber('0 dan 100 gacha foiz kiriting', 100),
    discountFixed: optionalNumber('Musbat summa kiriting'),
    maxUses: optionalNumber('Musbat son kiriting'),
    minOrderAmount: optionalNumber('Musbat summa kiriting'),
    expiresAt: z.string().optional(),
  })
  .refine((data) => data.discountPercent || data.discountFixed, {
    message: 'Foiz yoki summa chegirmasidan birini kiriting',
    path: ['discountPercent'],
  });

type FormData = z.infer<typeof schema>;

type StatusFilter = 'all' | 'active' | 'inactive' | 'expiring';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Hammasi' },
  { value: 'active', label: 'Faol' },
  { value: 'expiring', label: '7 kun ichida tugaydi' },
  { value: 'inactive', label: 'Faol emas' },
];

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'Hammasi',
  active: 'Faol',
  expiring: '7 kun ichida tugaydi',
  inactive: 'Faol emas',
};

const HEADERS: { label: string; align?: 'right' }[] = [
  { label: 'Kod' },
  { label: 'Chegirma', align: 'right' },
  { label: 'Ishlatilgan', align: 'right' },
  { label: 'Min. summa', align: 'right' },
  { label: 'Muddati' },
  { label: 'Holati' },
];

function expiresWithin7Days(promo: PromoCode): boolean {
  if (!promo.expiresAt) return false;
  const days = (new Date(promo.expiresAt).getTime() - Date.now()) / 86400000;
  return days > 0 && days <= 7;
}

export default function PromoCodesPage() {
  const { toast } = useToast();

  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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
      setLoadError('Promo kodlarni yuklab boʻlmadi.');
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    const code = data.code.toUpperCase();
    try {
      await createPromoCode({
        code,
        discountPercent: data.discountPercent ? Number(data.discountPercent) : undefined,
        discountFixed: data.discountFixed ? Number(data.discountFixed) : undefined,
        maxUses: data.maxUses ? Number(data.maxUses) : undefined,
        minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : undefined,
        expiresAt: data.expiresAt || undefined,
      });
      reset();
      setIsModalOpen(false);
      toast({
        title: `«${code}» promo kodi yaratildi`,
        description: 'Kod darhol amal qila boshlaydi.',
        variant: 'success',
      });
      await fetchPromoCodes();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Promo kod yaratib boʻlmadi';
      setSubmitError(message);
    }
  };

  // Newest first, so a just-created code is at the top where it is looked for.
  const rows = useMemo(() => {
    const needle = searchInput.trim().toLowerCase();
    return [...promoCodes]
      .filter((p) => {
        if (statusFilter === 'active') return p.isActive;
        if (statusFilter === 'inactive') return !p.isActive;
        if (statusFilter === 'expiring') return p.isActive && expiresWithin7Days(p);
        return true;
      })
      .filter((p) => (needle === '' ? true : p.code.toLowerCase().includes(needle)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [promoCodes, searchInput, statusFilter]);

  const hasFilters = Boolean(searchInput || statusFilter !== 'all');

  const clearFilters = () => {
    setSearchInput('');
    setStatusFilter('all');
  };

  const handleExport = () => {
    if (rows.length === 0) return;
    downloadCsv(
      'promo-kodlar',
      [
        'Kod',
        'Chegirma (%)',
        'Chegirma (soʻm)',
        'Ishlatilgan',
        'Limit',
        'Min. summa (soʻm)',
        'Muddati',
        'Holati',
      ],
      rows.map((p) => [
        p.code,
        p.discountPercent ?? '',
        p.discountFixed ?? '',
        p.usedCount,
        p.maxUses ?? '',
        p.minOrderAmount,
        p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('uz-UZ') : '',
        p.isActive ? 'Faol' : 'Faol emas',
      ])
    );
    toast({
      title: `${rows.length} ta promo kod CSV faylga eksport qilindi`,
      variant: 'success',
    });
  };

  const showSkeleton = isLoading && !hasLoadedOnce;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-5xl mx-auto">
        <PageHeader
          title="Promo kodlar"
          description="Chegirma kodlarini yaratish va boshqarish"
          icon={<Tag size={17} />}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={rows.length === 0}
                leftIcon={<Download size={13} />}
              >
                CSV eksport
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchPromoCodes}
                leftIcon={<RefreshCw size={13} />}
              >
                Yangilash
              </Button>
              <Button leftIcon={<Plus size={15} />} onClick={() => setIsModalOpen(true)} size="sm">
                Yangi promo kod
              </Button>
            </>
          }
        />

        <div className="flex items-center gap-3 flex-wrap mb-3">
          <Input
            placeholder="Kod boʻyicha qidirish"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            leftElement={<Search size={14} />}
            className="w-56"
            aria-label="Promo kodlarni qidirish"
          />
          <Tabs items={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} size="sm" />
        </div>

        {hasFilters && (
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {searchInput && (
              <FilterChip
                label={`Qidiruv: "${searchInput}"`}
                onRemove={() => setSearchInput('')}
              />
            )}
            {statusFilter !== 'all' && (
              <FilterChip
                label={`Holat: ${STATUS_LABEL[statusFilter]}`}
                onRemove={() => setStatusFilter('all')}
              />
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Hammasini tozalash
            </Button>
          </div>
        )}

        {loadError && (
          <RetryBanner
            message={loadError}
            onRetry={fetchPromoCodes}
            keepsLastData={promoCodes.length > 0}
            className="mb-3"
          />
        )}

        {loadError && promoCodes.length === 0 ? (
          <ErrorState
            message="Tarmoq yoki server xatosi. Qayta urinib koʻring."
            onRetry={fetchPromoCodes}
          />
        ) : showSkeleton ? (
          <SkeletonTable rows={5} cols={HEADERS.length} />
        ) : rows.length === 0 ? (
          <Card>
            {hasFilters ? (
              <EmptyState
                icon={<Search size={22} />}
                title="Filtrga mos promo kod topilmadi"
                description="Qidiruv soʻzini yoki holat filtrini oʻzgartirib koʻring."
                action={
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Filtrlarni tozalash
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Tag size={22} />}
                title="Hali promo kod yaratilmagan"
                description="Birinchi chegirma kodini yarating — u darhol amal qila boshlaydi."
                action={
                  <Button
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={() => setIsModalOpen(true)}
                  >
                    Yangi promo kod
                  </Button>
                }
              />
            )}
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-16rem)]">
              <table className="w-full text-sm text-left">
                <thead className="text-subtle uppercase text-[10px] tracking-wider">
                  <tr>
                    {HEADERS.map((h, i) => (
                      <th
                        key={i}
                        className={`sticky-th bg-surface-2 px-4 py-3 font-semibold whitespace-nowrap ${
                          h.align === 'right' ? 'text-right' : ''
                        }`}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((promo) => (
                    <tr key={promo.id} className="hover:bg-surface-2/70 transition-colors">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 font-mono font-semibold text-ink">
                          <Tag size={13} className="text-mint-deep shrink-0" aria-hidden />
                          {promo.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-ink whitespace-nowrap text-right tabular-nums">
                        {promo.discountPercent != null
                          ? `${promo.discountPercent}%`
                          : formatMoney(promo.discountFixed)}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted text-right tabular-nums">
                        {formatNumber(promo.usedCount)}
                        {promo.maxUses != null ? ` / ${formatNumber(promo.maxUses)}` : ''}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted whitespace-nowrap text-right tabular-nums">
                        {formatMoney(promo.minOrderAmount)}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap tabular-nums">
                        {promo.expiresAt ? formatDate(promo.expiresAt) : '—'}
                        {expiresWithin7Days(promo) && (
                          <span className="ml-2 text-info-deep dark:text-info-light">
                            · tez orada
                          </span>
                        )}
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

            <div className="px-4 py-3 text-xs text-muted border-t border-line">
              <span className="font-mono tabular-nums">{rows.length}</span> / jami{' '}
              <span className="font-mono tabular-nums">{promoCodes.length}</span> ta promo kod
            </div>
          </Card>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Yangi promo kod"
        subtitle="Kod yaratilgach darhol amal qiladi"
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

          <Input
            label="Kod"
            placeholder="ANGREN10"
            mono
            hint="Katta harfga oʻgiriladi"
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
              error={errors.discountFixed?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Max ishlatish soni"
              type="number"
              placeholder="100"
              mono
              {...register('maxUses')}
              error={errors.maxUses?.message}
            />
            <Input
              label="Min buyurtma summasi"
              type="number"
              placeholder="0"
              mono
              {...register('minOrderAmount')}
              error={errors.minOrderAmount?.message}
            />
          </div>
          <Input
            label="Amal qilish muddati"
            type="date"
            hint="Boʻsh qoldirilsa muddatsiz"
            {...register('expiresAt')}
            error={errors.expiresAt?.message}
          />
          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Yaratish
          </Button>
        </form>
      </Modal>
    </div>
  );
}
