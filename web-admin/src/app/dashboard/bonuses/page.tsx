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
import { t } from '@/locales';

/** Sxema va yorliqlar funksiya ichida — matnlar joriy tilda chiqishi uchun. */
function bonusRuleSchema() {
  const v = t().bonuses;
  return z.object({
    name: z.string().min(2, v.minLetters),
    ruleType: z.enum(['trip_count', 'weekly_goal']),
    tripThreshold: z.coerce.number().int().min(1, v.minOne),
    bonusAmount: z.coerce.number().min(0, v.nonNegative),
    serviceType: z.string().optional(),
  });
}

type BonusRuleForm = z.infer<ReturnType<typeof bonusRuleSchema>>;
type StatusFilter = 'all' | 'active' | 'inactive';

const ruleTypeLabel = (type: BonusRule['ruleType']): string => {
  const m = t().bonuses;
  return type === 'trip_count' ? m.typeTripCount : m.typeWeeklyGoal;
};

const statusLabel = (status: Exclude<StatusFilter, 'all'>): string =>
  status === 'active' ? t().common.active : t().common.inactive;

const statusItems = (): { value: StatusFilter; label: string }[] => {
  const c = t().common;
  return [
    { value: 'all', label: c.all },
    { value: 'active', label: c.active },
    { value: 'inactive', label: c.inactive },
  ];
};

const ruleTypeOptions = () => [
  { value: 'trip_count', label: ruleTypeLabel('trip_count') },
  { value: 'weekly_goal', label: ruleTypeLabel('weekly_goal') },
];

export default function BonusesPage() {
  const m = t();
  const bm = m.bonuses;
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
  } = useForm<BonusRuleForm>({ resolver: zodResolver(bonusRuleSchema()) });

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await bonusRulesApi.getAll();
      setRules(res.data.data);
      setError(null);
    } catch {
      // Oxirgi muvaffaqiyatli qatorlar ekranda qoladi; banner + retry chiqadi.
      setError(t().bonuses.loadError);
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
        [r.name, ruleTypeLabel(r.ruleType), r.serviceType ?? ''].join(' ').toLowerCase().includes(q)
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
    chips.push({ key: 'search', label: bm.chipSearch(search.trim()), onRemove: () => setSearch('') });
  }
  if (statusFilter !== 'all') {
    chips.push({
      key: 'status',
      label: bm.chipStatus(statusLabel(statusFilter)),
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
        title: bm.created,
        description: bm.createdDescription(data.name),
        variant: 'success',
      });
      setModalOpen(false);
      await fetchRules();
    } catch {
      toast({ title: m.common.error, description: bm.saveError, variant: 'error' });
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
        title: next === 'active' ? bm.enabledToast(rule.name) : bm.disabledToast(rule.name),
        description: next === 'active' ? bm.enabledHint : bm.disabledHint,
        variant: 'success',
      });
    } catch {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? rule : r)));
      toast({ title: m.common.error, description: m.common.statusChangeFailed, variant: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) return;
    downloadCsv<BonusRule>(
      bm.csvFile(new Date().toISOString().slice(0, 10)),
      [
        { header: bm.csvName, value: (r) => r.name },
        { header: bm.colType, value: (r) => ruleTypeLabel(r.ruleType) },
        { header: bm.colThreshold, value: (r) => r.tripThreshold },
        { header: bm.csvAmount, value: (r) => r.bonusAmount },
        { header: bm.colService, value: (r) => r.serviceType ?? '' },
        { header: m.common.statusAlt, value: (r) => (r.status === 'active' ? m.common.active : m.common.inactive) },
        { header: bm.csvCreated, value: (r) => formatDateTime(r.createdAt, { withYear: true }) },
      ],
      filteredRows
    );
    toast({ title: bm.csvDone, description: bm.csvRows(filteredRows.length), variant: 'success' });
  };

  const columns: DataTableColumn<BonusRule>[] = [
    {
      key: 'name',
      header: bm.colRule,
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
      header: bm.colType,
      cell: (r) => <Badge variant="neutral">{ruleTypeLabel(r.ruleType)}</Badge>,
    },
    {
      key: 'tripThreshold',
      header: bm.colThreshold,
      numeric: true,
      sortable: true,
      cell: (r) => formatNumber(r.tripThreshold),
    },
    {
      key: 'bonusAmount',
      header: bm.colBonus,
      numeric: true,
      sortable: true,
      cell: (r) => <MoneyText value={r.bonusAmount} className="font-medium" />,
    },
    {
      key: 'serviceType',
      header: bm.colService,
      className: 'text-muted',
      cell: (r) => r.serviceType || '—',
    },
    {
      key: 'status',
      header: m.common.active,
      align: 'right',
      cell: (rule) => (
        <div className="flex items-center justify-end gap-2.5">
          {/* Holat rang bilan emas, SO'Z bilan ham aytiladi. */}
          <span className={rule.status === 'active' ? 'text-xs font-medium text-primary-text' : 'text-xs text-subtle'}>
            {rule.status === 'active' ? m.common.active : m.common.inactive}
          </span>
          <Switch
            size="sm"
            checked={rule.status === 'active'}
            disabled={togglingId === rule.id}
            onCheckedChange={() => handleToggle(rule)}
            aria-label={bm.toggleAria(rule.name, rule.status === 'active')}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title={bm.title}
        description={bm.total(formatNumber(rules.length))}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
              leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              {bm.csvExport}
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={openCreate}>
              {bm.newRule}
            </Button>
          </>
        }
      />

      <DataTable
        ariaLabel={bm.tableAria}
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
            searchPlaceholder={bm.searchPlaceholder}
            searchAriaLabel={bm.searchAria}
            chips={chips}
            onClearAll={clearAllFilters}
          >
            <SegmentedControl
              ariaLabel={m.common.statusFilter}
              items={statusItems()}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </FilterBar>
        }
        isFiltered={hasActiveFilters}
        onClearFilters={clearAllFilters}
        emptyFiltered={{ title: bm.noMatch, description: bm.noMatchHint }}
        empty={{
          variant: 'first-use',
          title: bm.empty,
          description: bm.emptyHint,
          action: (
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={openCreate}>
              {bm.createFirst}
            </Button>
          ),
        }}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={bm.modalTitle}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              {m.common.cancel}
            </Button>
            <Button type="submit" form="bonus-rule-form" isLoading={saving}>
              {bm.create}
            </Button>
          </>
        }
      >
        {/* Validatsiya xatolari maydonning O'ZIGA biriktiriladi (zod + Input error). */}
        <form id="bonus-rule-form" onSubmit={handleSubmit(handleSave)} className="space-y-4" noValidate>
          <Input
            label={bm.ruleName}
            placeholder={bm.ruleNamePlaceholder}
            error={errors.name?.message}
            {...register('name')}
          />
          <Select label={bm.ruleType} options={ruleTypeOptions()} error={errors.ruleType?.message} {...register('ruleType')} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={bm.threshold}
              type="number"
              placeholder="50"
              error={errors.tripThreshold?.message}
              {...register('tripThreshold')}
            />
            <Input
              label={bm.amount}
              type="number"
              placeholder="50000"
              error={errors.bonusAmount?.message}
              {...register('bonusAmount')}
            />
          </div>
          <Input
            label={bm.service}
            placeholder="taxi"
            hint={bm.serviceHint}
            {...register('serviceType')}
          />
        </form>
      </Modal>
    </div>
  );
}
