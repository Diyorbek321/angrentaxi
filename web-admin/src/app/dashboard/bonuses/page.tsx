'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  Input,
  Modal,
  MoneyText,
  PageHeader,
  SegmentedControl,
  Select,
  Switch,
  type DataTableColumn,
  type FilterChipData,
  type SortState,
} from '@/components/ui';
import { bonusRulesApi, BonusRule, BonusRuleCreateInput } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { formatDateShort, formatDateTime, formatNumber } from '@/lib/format';

const bonusRuleSchema = z.object({
  name: z.string().min(2, 'Kamida 2 ta harf'),
  ruleType: z.enum(['trip_count', 'weekly_goal']),
  tripThreshold: z.coerce.number().int().min(1, "Kamida 1 bo'lishi kerak"),
  bonusAmount: z.coerce.number().min(0, "Manfiy qiymat bo'lmasin"),
  serviceType: z.string().optional(),
});

type BonusRuleForm = z.infer<typeof bonusRuleSchema>;
type StatusFilter = 'all' | 'active' | 'inactive';

const ruleTypeLabel: Record<BonusRule['ruleType'], string> = {
  trip_count: 'Safar soni',
  weekly_goal: 'Haftalik maqsad',
};

const STATUS_LABELS: Record<Exclude<StatusFilter, 'all'>, string> = {
  active: 'Faol',
  inactive: 'Nofaol',
};

const STATUS_ITEMS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Hammasi' },
  { value: 'active', label: 'Faol' },
  { value: 'inactive', label: 'Nofaol' },
];

const RULE_TYPE_OPTIONS = [
  { value: 'trip_count', label: 'Safar soni' },
  { value: 'weekly_goal', label: 'Haftalik maqsad' },
];

export default function BonusesPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<BonusRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortState | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BonusRuleForm>({ resolver: zodResolver(bonusRuleSchema) });

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await bonusRulesApi.getAll();
      setRules(res.data.data);
      setError(null);
    } catch {
      // Oxirgi muvaffaqiyatli qatorlar ekranda qoladi; banner + retry chiqadi.
      setError("Bonus qoidalarini yuklab bo'lmadi");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = rules;
    if (q) {
      rows = rows.filter((r) =>
        [r.name, ruleTypeLabel[r.ruleType], r.serviceType ?? ''].join(' ').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      rows = rows.filter((r) => (statusFilter === 'active' ? r.status === 'active' : r.status !== 'active'));
    }
    if (sort) {
      const dir = sort.direction === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        switch (sort.key) {
          case 'name':
            return a.name.localeCompare(b.name) * dir;
          case 'tripThreshold':
            return (a.tripThreshold - b.tripThreshold) * dir;
          case 'bonusAmount':
            return (a.bonusAmount - b.bonusAmount) * dir;
          case 'createdAt':
            return a.createdAt.localeCompare(b.createdAt) * dir;
          default:
            return 0;
        }
      });
    }
    return rows;
  }, [rules, search, statusFilter, sort]);

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  const chips: FilterChipData[] = [];
  if (search.trim()) {
    chips.push({ key: 'search', label: `Qidiruv: "${search.trim()}"`, onRemove: () => setSearch('') });
  }
  if (statusFilter !== 'all') {
    chips.push({
      key: 'status',
      label: `Holat: ${STATUS_LABELS[statusFilter]}`,
      onRemove: () => setStatusFilter('all'),
    });
  }
  const hasActiveFilters = chips.length > 0;

  const openCreate = () => {
    reset({ name: '', ruleType: 'trip_count', tripThreshold: 10, bonusAmount: 0, serviceType: '' });
    setModalOpen(true);
  };

  const handleSave = async (data: BonusRuleForm) => {
    setSaving(true);
    try {
      const payload: BonusRuleCreateInput = {
        name: data.name,
        ruleType: data.ruleType,
        tripThreshold: data.tripThreshold,
        bonusAmount: data.bonusAmount,
        serviceType: data.serviceType || undefined,
      };
      await bonusRulesApi.create(payload);
      toast({
        title: 'Bonus qoidasi yaratildi',
        description: `«${data.name}» ro'yxatga qo'shildi.`,
        variant: 'success',
      });
      setModalOpen(false);
      await fetchRules();
    } catch {
      toast({ title: 'Xatolik', description: 'Qoidani saqlashda xatolik', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Inline toggle — API ikkala yo'nalishni ham qo'llab-quvvatlaydi
   * (`update({ status })`), ya'ni amal QAYTARILADIGAN: modal shart emas,
   * natija toast bilan aytiladi (doktrina: modal faqat destruktiv/moliyaviy).
   */
  const handleToggle = async (rule: BonusRule) => {
    const next = rule.status === 'active' ? 'inactive' : 'active';
    setTogglingId(rule.id);
    // Optimistik yangilanish — rad javobida orqaga qaytariladi.
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, status: next } : r)));
    try {
      const res = await bonusRulesApi.update(rule.id, { status: next });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? res.data.data : r)));
      toast({
        title: next === 'active' ? `«${rule.name}» yoqildi` : `«${rule.name}» o'chirildi`,
        description:
          next === 'active'
            ? 'Haydovchilar bu bonusni yig\'a boshlaydi.'
            : 'Yangi bonus hisoblanmaydi; allaqachon berilganlari saqlanadi.',
        variant: 'success',
      });
    } catch {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? rule : r)));
      toast({ title: 'Xatolik', description: "Holatni o'zgartirib bo'lmadi", variant: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) return;
    downloadCsv<BonusRule>(
      `bonus-qoidalari-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'Nomi', value: (r) => r.name },
        { header: 'Turi', value: (r) => ruleTypeLabel[r.ruleType] },
        { header: 'Safar chegarasi', value: (r) => r.tripThreshold },
        { header: 'Bonus summasi', value: (r) => r.bonusAmount },
        { header: 'Xizmat turi', value: (r) => r.serviceType ?? '' },
        { header: 'Holati', value: (r) => (r.status === 'active' ? 'Faol' : 'Nofaol') },
        { header: 'Yaratilgan', value: (r) => formatDateTime(r.createdAt, { withYear: true }) },
      ],
      filteredRows
    );
    toast({ title: 'CSV yuklab olindi', description: `${filteredRows.length} ta qator`, variant: 'success' });
  };

  const columns: DataTableColumn<BonusRule>[] = [
    {
      key: 'name',
      header: 'Qoida',
      sortable: true,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{r.name}</p>
          <p className="num text-xs text-subtle">{formatDateShort(r.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'ruleType',
      header: 'Turi',
      cell: (r) => <Badge variant="neutral">{ruleTypeLabel[r.ruleType]}</Badge>,
    },
    {
      key: 'tripThreshold',
      header: 'Safar chegarasi',
      numeric: true,
      sortable: true,
      cell: (r) => formatNumber(r.tripThreshold),
    },
    {
      key: 'bonusAmount',
      header: 'Bonus',
      numeric: true,
      sortable: true,
      cell: (r) => <MoneyText value={r.bonusAmount} className="font-medium" />,
    },
    {
      key: 'serviceType',
      header: 'Xizmat turi',
      className: 'text-muted',
      cell: (r) => r.serviceType || '—',
    },
    {
      key: 'status',
      header: 'Faol',
      align: 'right',
      cell: (rule) => (
        <div className="flex items-center justify-end gap-2.5">
          {/* Holat rang bilan emas, SO'Z bilan ham aytiladi. */}
          <span className={rule.status === 'active' ? 'text-xs font-medium text-primary-text' : 'text-xs text-subtle'}>
            {rule.status === 'active' ? 'Faol' : 'Nofaol'}
          </span>
          <Switch
            size="sm"
            checked={rule.status === 'active'}
            disabled={togglingId === rule.id}
            onCheckedChange={() => handleToggle(rule)}
            aria-label={`«${rule.name}» qoidasini ${rule.status === 'active' ? "o'chirish" : 'yoqish'}`}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Haydovchi bonuslari"
        description={`Jami: ${formatNumber(rules.length)} ta qoida`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
              leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              CSV eksport
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={openCreate}>
              Yangi qoida
            </Button>
          </>
        }
      />

      <DataTable
        ariaLabel="Bonus qoidalari"
        columns={columns}
        rows={filteredRows}
        rowKey={(r) => r.id}
        loading={isLoading}
        error={error}
        onRetry={fetchRules}
        sort={sort}
        onSortChange={setSort}
        maxHeightClassName="max-h-[65vh]"
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Qoida nomi yoki xizmat turi…"
            searchAriaLabel="Bonus qoidalarini qidirish"
            chips={chips}
            onClearAll={clearAllFilters}
          >
            <SegmentedControl
              ariaLabel="Holat bo'yicha filtr"
              items={STATUS_ITEMS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </FilterBar>
        }
        isFiltered={hasActiveFilters}
        onClearFilters={clearAllFilters}
        emptyFiltered={{ title: 'Hech narsa mos kelmadi', description: "Tanlangan filtrlar bo'yicha bonus qoidasi topilmadi." }}
        empty={{
          variant: 'first-use',
          title: "Bonus qoidalari yo'q",
          description: "Haydovchilarni rag'batlantirish uchun birinchi bonus qoidasini yarating.",
          action: (
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={openCreate}>
              Birinchi qoidani yaratish
            </Button>
          ),
        }}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Yangi bonus qoidasi"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" form="bonus-rule-form" isLoading={saving}>
              Yaratish
            </Button>
          </>
        }
      >
        {/* Validatsiya xatolari maydonning O'ZIGA biriktiriladi (zod + Input error). */}
        <form id="bonus-rule-form" onSubmit={handleSubmit(handleSave)} className="space-y-4" noValidate>
          <Input
            label="Qoida nomi"
            placeholder="50 ta safar bonusi"
            error={errors.name?.message}
            {...register('name')}
          />
          <Select label="Qoida turi" options={RULE_TYPE_OPTIONS} error={errors.ruleType?.message} {...register('ruleType')} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Safar soni chegarasi"
              type="number"
              placeholder="50"
              error={errors.tripThreshold?.message}
              {...register('tripThreshold')}
            />
            <Input
              label="Bonus summasi (so'm)"
              type="number"
              placeholder="50000"
              error={errors.bonusAmount?.message}
              {...register('bonusAmount')}
            />
          </div>
          <Input
            label="Xizmat turi (ixtiyoriy)"
            placeholder="taxi"
            hint="Bo'sh qoldirilsa qoida barcha xizmat turlariga qo'llanadi."
            {...register('serviceType')}
          />
        </form>
      </Modal>
    </div>
  );
}
