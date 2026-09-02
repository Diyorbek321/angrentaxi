'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Gift,
  Plus,
  Search,
  SearchX,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { FilterChips, type FilterChip } from '@/components/ui/FilterChips';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { bonusRulesApi, BonusRule, BonusRuleCreateInput } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv } from '@/lib/csv';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

const bonusRuleSchema = z.object({
  name: z.string().min(2, 'Kamida 2 ta harf'),
  ruleType: z.enum(['trip_count', 'weekly_goal']),
  tripThreshold: z.coerce.number().int().min(1, "Kamida 1 bo'lishi kerak"),
  bonusAmount: z.coerce.number().min(0, "Manfiy qiymat bo'lmasin"),
  serviceType: z.string().optional(),
});

type BonusRuleForm = z.infer<typeof bonusRuleSchema>;
type SortDir = 'asc' | 'desc' | null;
type StatusFilter = 'all' | 'active' | 'inactive';

const ruleTypeLabel: Record<BonusRule['ruleType'], string> = {
  trip_count: 'Safar soni',
  weekly_goal: 'Haftalik maqsad',
};

const STATUS_LABELS: Record<Exclude<StatusFilter, 'all'>, string> = {
  active: 'Faol',
  inactive: 'Nofaol',
};

export default function BonusesPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<BonusRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<BonusRuleForm>({ resolver: zodResolver(bonusRuleSchema) });

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const res = await bonusRulesApi.getAll();
      setRules(res.data.data);
      setError(null);
      setHasLoadedOnce(true);
    } catch {
      // Oxirgi muvaffaqiyatli qatorlar ekranda qoladi; banner + retry chiqadi.
      setError("Bonus qoidalarini yuklab bo'lmadi");
      toast({ title: 'Xatolik', description: 'Qoidalarni yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (sortField && sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        switch (sortField) {
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
  }, [rules, search, statusFilter, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortField(null);
      setSortDir(null);
    }
  };

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  const chips: FilterChip[] = [];
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
        { header: 'Yaratilgan', value: (r) => formatDate(r.createdAt) },
      ],
      filteredRows
    );
    toast({ title: 'CSV yuklab olindi', description: `${filteredRows.length} ta qator`, variant: 'success' });
  };

  const SortableHead = ({
    field,
    children,
    align = 'left',
  }: {
    field: string;
    children: React.ReactNode;
    align?: 'left' | 'right';
  }) => {
    const active = sortField === field && !!sortDir;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <TableHead
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={align === 'right' ? 'text-right' : undefined}
      >
        <button
          type="button"
          onClick={() => handleSort(field)}
          className={cn(
            'inline-flex items-center gap-1 text-micro uppercase transition-colors duration-fast',
            align === 'right' && 'flex-row-reverse',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2',
            active ? 'text-primary-text' : 'text-muted hover:text-ink'
          )}
        >
          {children}
          <Icon className={cn('h-3 w-3', active ? 'text-primary-text' : 'text-subtle')} aria-hidden="true" />
        </button>
      </TableHead>
    );
  };

  const showFullError = error && !isLoading && !hasLoadedOnce;
  const showErrorBanner = error && !isLoading && hasLoadedOnce;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Haydovchi bonuslari"
        description={`Jami: ${rules.length.toLocaleString('uz-UZ')} ta qoida`}
        icon={<Gift className="h-4 w-4" aria-hidden="true" />}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
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
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              placeholder="Qoida nomi yoki xizmat turi bo'yicha qidirish..."
              leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Bonus qoidalarini qidirish"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-44" aria-label="Holat bo'yicha filtr">
              <SelectValue placeholder="Holat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha holatlar</SelectItem>
              <SelectItem value="active">Faol</SelectItem>
              <SelectItem value="inactive">Nofaol</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <FilterChips chips={chips} onClearAll={clearAllFilters} />

        {showErrorBanner && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-4 py-3"
          >
            <p className="flex items-center gap-2 text-body text-danger-deep dark:text-danger-light">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error} — oxirgi muvaffaqiyatli yuklangan ma&apos;lumot ko&apos;rsatilmoqda.
            </p>
            <Button variant="secondary" size="sm" onClick={fetchRules}>
              Qayta urinish
            </Button>
          </div>
        )}

        {showFullError ? (
          <Card>
            <CardContent className="p-0">
              <ErrorState message={error} onRetry={fetchRules} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {isLoading && !hasLoadedOnce ? (
                <SkeletonTable rows={6} cols={6} className="border-0" />
              ) : filteredRows.length === 0 ? (
                hasActiveFilters ? (
                  <EmptyState
                    icon={<SearchX className="h-6 w-6" />}
                    title="Hech narsa mos kelmadi"
                    description="Tanlangan filtrlar bo'yicha bonus qoidasi topilmadi."
                    action={
                      <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                        Filtrlarni tozalash
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<Gift className="h-6 w-6" />}
                    title="Bonus qoidalari yo'q"
                    description="Haydovchilarni rag'batlantirish uchun birinchi bonus qoidasini yarating."
                    action={
                      <Button size="sm" leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={openCreate}>
                        Birinchi qoidani yaratish
                      </Button>
                    }
                  />
                )
              ) : (
                <Table stickyHeader containerClassName="max-h-[65vh]">
                  <TableHeader>
                    <TableRow>
                      <SortableHead field="name">Qoida</SortableHead>
                      <TableHead>Turi</TableHead>
                      <SortableHead field="tripThreshold" align="right">
                        Safar chegarasi
                      </SortableHead>
                      <SortableHead field="bonusAmount" align="right">
                        Bonus
                      </SortableHead>
                      <TableHead>Xizmat turi</TableHead>
                      <TableHead className="text-right">Faol</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <p className="font-medium text-ink">{rule.name}</p>
                          <p className="text-caption tabular-nums text-subtle">
                            {formatDate(rule.createdAt, 'dd.MM.yyyy')}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="info">{ruleTypeLabel[rule.ruleType]}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-ink">
                          {rule.tripThreshold}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums text-ink">
                          {formatCurrency(rule.bonusAmount)}
                        </TableCell>
                        <TableCell className="text-muted">{rule.serviceType ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2.5">
                            {/* Holat rang bilan emas, SO'Z bilan ham aytiladi. */}
                            <span
                              className={cn(
                                'text-caption font-semibold',
                                rule.status === 'active' ? 'text-primary-text' : 'text-subtle'
                              )}
                            >
                              {rule.status === 'active' ? 'Faol' : 'Nofaol'}
                            </span>
                            <Switch
                              checked={rule.status === 'active'}
                              disabled={togglingId === rule.id}
                              onCheckedChange={() => handleToggle(rule)}
                              aria-label={`«${rule.name}» qoidasini ${
                                rule.status === 'active' ? "o'chirish" : 'yoqish'
                              }`}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yangi bonus qoidasi</DialogTitle>
          </DialogHeader>
          {/* Validatsiya xatolari maydonning O'ZIGA biriktiriladi (zod + Input error). */}
          <form onSubmit={handleSubmit(handleSave)} className="space-y-4" noValidate>
            <Input
              label="Qoida nomi"
              placeholder="50 ta safar bonusi"
              error={errors.name?.message}
              {...register('name')}
            />
            <div>
              <label className="mb-1.5 block text-caption font-medium text-muted" htmlFor="ruleType">
                Qoida turi
              </label>
              <Select
                defaultValue="trip_count"
                onValueChange={(v) => setValue('ruleType', v as BonusRuleForm['ruleType'])}
              >
                <SelectTrigger id="ruleType" className="w-full">
                  <SelectValue placeholder="Qoida turi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trip_count">Safar soni</SelectItem>
                  <SelectItem value="weekly_goal">Haftalik maqsad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Safar soni chegarasi"
                type="number"
                mono
                placeholder="50"
                error={errors.tripThreshold?.message}
                {...register('tripThreshold')}
              />
              <Input
                label="Bonus summasi (so'm)"
                type="number"
                mono
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
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Bekor qilish
              </Button>
              <Button type="submit" isLoading={saving}>
                Yaratish
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
