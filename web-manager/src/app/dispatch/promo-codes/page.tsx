'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Download, Plus, RefreshCw, Tag } from 'lucide-react';
import { getPromoCodes, createPromoCode, PromoCode } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { FilterBar } from '@/components/ui/FilterBar';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageBody } from '@/components/ui/PageBody';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatDate, formatDateShort, formatNumber } from '@/lib/format';
import { serviceTypesLabel, serviceTypesPayload, type PromoServiceType } from '@/lib/promo-service-types';
import { ServiceTypePicker, ServiceTypesCell } from '@/components/promo/ServiceTypePicker';

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

const STATUS_TABS: readonly { value: StatusFilter; label: string }[] = [
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
  const [serviceTypes, setServiceTypes] = useState<PromoServiceType[]>([]);

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
        ...serviceTypesPayload(serviceTypes),
      });
      reset();
      setServiceTypes([]);
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
        'Xizmatlar',
        'Holati',
      ],
      rows.map((p) => [
        p.code,
        p.discountPercent ?? '',
        p.discountFixed ?? '',
        p.usedCount,
        p.maxUses ?? '',
        p.minOrderAmount,
        p.expiresAt ? formatDateShort(p.expiresAt) : '',
        serviceTypesLabel(p.serviceTypes),
        p.isActive ? 'Faol' : 'Faol emas',
      ])
    );
    toast({
      title: `${rows.length} ta promo kod CSV faylga eksport qilindi`,
      variant: 'success',
    });
  };

  const showSkeleton = isLoading && !hasLoadedOnce;

  const columns: DataTableColumn<PromoCode>[] = [
    {
      key: 'code',
      header: 'Kod',
      cell: (p) => <span className="font-mono font-semibold text-ink">{p.code}</span>,
    },
    {
      key: 'discount',
      header: 'Chegirma',
      numeric: true,
      cell: (p) =>
        p.discountPercent != null ? (
          <span className="text-ink">{p.discountPercent}%</span>
        ) : (
          <MoneyText value={p.discountFixed} className="text-ink" />
        ),
    },
    {
      key: 'used',
      header: 'Ishlatilgan',
      numeric: true,
      cell: (p) => (
        <span className="text-muted">
          {formatNumber(p.usedCount)}
          {p.maxUses != null ? ` / ${formatNumber(p.maxUses)}` : ''}
        </span>
      ),
    },
    {
      key: 'services',
      header: 'Xizmatlar',
      hideBelow: 'lg',
      cell: (p) => <ServiceTypesCell value={p.serviceTypes} />,
    },
    {
      key: 'min',
      header: 'Min. summa',
      numeric: true,
      hideBelow: 'md',
      cell: (p) => <MoneyText value={p.minOrderAmount} className="text-muted" />,
    },
    {
      key: 'expires',
      header: 'Muddati',
      className: 'num text-muted whitespace-nowrap',
      cell: (p) => (
        <>
          {p.expiresAt ? formatDate(p.expiresAt) : '—'}
          {expiresWithin7Days(p) && <span className="ml-2 text-info-dark dark:text-info-light">· tez orada</span>}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Holati',
      cell: (p) => (
        <Badge variant={p.isActive ? 'success' : 'neutral'} size="sm" dot>
          {p.isActive ? 'Faol' : 'Faol emas'}
        </Badge>
      ),
    },
  ];

  const chips = [
    ...(searchInput
      ? [{ key: 'q', label: `Qidiruv: "${searchInput}"`, onRemove: () => setSearchInput('') }]
      : []),
    ...(statusFilter !== 'all'
      ? [{ key: 'status', label: `Holat: ${STATUS_LABEL[statusFilter]}`, onRemove: () => setStatusFilter('all') }]
      : []),
  ];

  return (
    <PageBody className="max-w-5xl">
      <PageHeader
        title="Promo kodlar"
        description="Chegirma kodlarini yaratish va boshqarish"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={rows.length === 0}
              leftIcon={<Download size={13} aria-hidden />}
            >
              CSV eksport
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchPromoCodes}
              isLoading={isLoading && hasLoadedOnce}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              Yangilash
            </Button>
            <Button leftIcon={<Plus size={14} aria-hidden />} onClick={() => setIsModalOpen(true)} size="sm">
              Yangi promo kod
            </Button>
          </>
        }
      />

      <FilterBar
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Kod boʻyicha qidirish"
        chips={chips}
        onClearAll={clearFilters}
        className="mb-3"
      >
        <SegmentedControl
          items={STATUS_TABS}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Holat boʻyicha filtr"
        />
      </FilterBar>

      <DataTable
        ariaLabel="Promo kodlar"
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        loading={showSkeleton}
        error={loadError}
        onRetry={fetchPromoCodes}
        maxHeightClassName="max-h-[calc(100vh-16rem)]"
        footer={
          hasLoadedOnce && rows.length > 0 ? (
            <span className="num">
              {hasFilters
                ? `${formatNumber(rows.length)} / jami ${formatNumber(promoCodes.length)} ta promo kod`
                : `${formatNumber(rows.length)} ta promo kod`}
            </span>
          ) : undefined
        }
        isFiltered={hasFilters}
        onClearFilters={clearFilters}
        emptyFiltered={{
          title: 'Filtrga mos promo kod topilmadi',
          description: 'Qidiruv soʻzini yoki holat filtrini oʻzgartirib koʻring.',
        }}
        empty={{
          variant: 'first-use',
          icon: <Tag aria-hidden />,
          title: 'Hali promo kod yaratilmagan',
          description: 'Birinchi chegirma kodini yarating — u darhol amal qila boshlaydi.',
          action: (
            <Button size="sm" leftIcon={<Plus size={14} aria-hidden />} onClick={() => setIsModalOpen(true)}>
              Yangi promo kod
            </Button>
          ),
        }}
      />

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
              className="flex items-start gap-2.5 rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2"
            >
              <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" aria-hidden />
              <p className="text-[13px] text-danger-dark dark:text-danger-light">{submitError}</p>
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
              {...register('discountPercent')}
              error={errors.discountPercent?.message}
            />
            <Input
              label="Chegirma (soʻm)"
              type="number"
              placeholder="5000"
              {...register('discountFixed')}
              error={errors.discountFixed?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Max ishlatish soni"
              type="number"
              placeholder="100"
              {...register('maxUses')}
              error={errors.maxUses?.message}
            />
            <Input
              label="Min buyurtma summasi"
              type="number"
              placeholder="0"
              {...register('minOrderAmount')}
              error={errors.minOrderAmount?.message}
            />
          </div>
          <ServiceTypePicker value={serviceTypes} onChange={setServiceTypes} disabled={isSubmitting} />
          <Input
            label="Amal qilish muddati"
            type="date"
            hint="Boʻsh qoldirilsa muddatsiz"
            {...register('expiresAt')}
            error={errors.expiresAt?.message}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Yaratish
            </Button>
          </div>
        </form>
      </Modal>
    </PageBody>
  );
}
