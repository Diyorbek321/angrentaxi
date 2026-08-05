'use client';

import { useEffect, useState } from 'react';
import { Plus, Gift, ToggleLeft, ToggleRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
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
import { SkeletonCards } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { bonusRulesApi, BonusRule, BonusRuleCreateInput } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/utils';

const bonusRuleSchema = z.object({
  name: z.string().min(2, 'Kamida 2 ta harf'),
  ruleType: z.enum(['trip_count', 'weekly_goal']),
  tripThreshold: z.coerce.number().int().min(1, "Kamida 1 bo'lishi kerak"),
  bonusAmount: z.coerce.number().min(0, "Manfiy qiymat bo'lmasin"),
  serviceType: z.string().optional(),
});

type BonusRuleForm = z.infer<typeof bonusRuleSchema>;

const ruleTypeLabel: Record<BonusRule['ruleType'], string> = {
  trip_count: 'Safar soni',
  weekly_goal: 'Haftalik maqsad',
};

export default function BonusesPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<BonusRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
    } catch {
      setError("Bonus qoidalarini yuklab bo'lmadi.");
      toast({ title: 'Xatolik', description: "Qoidalarni yuklashda xatolik", variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      toast({ title: 'Bonus qoidasi yaratildi', variant: 'success' });
      setModalOpen(false);
      await fetchRules();
    } catch {
      toast({ title: 'Xatolik', description: "Qoidani saqlashda xatolik", variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: BonusRule) => {
    try {
      const res = await bonusRulesApi.update(rule.id, {
        status: rule.status === 'active' ? 'inactive' : 'active',
      });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? res.data.data : r)));
      toast({
        title: res.data.data.status === 'active' ? 'Qoida faollashtirildi' : 'Qoida o\'chirildi',
        variant: 'success',
      });
    } catch {
      toast({ title: 'Xatolik', variant: 'error' });
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Haydovchi bonuslari"
        description="Bonus qoidalarini boshqaring"
        icon={<Gift className="h-4 w-4" />}
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Yangi qoida
          </Button>
        }
      />
      <div className="space-y-4">
        {error ? (
          <Card>
            <CardContent>
              <ErrorState message={error} onRetry={fetchRules} />
            </CardContent>
          </Card>
        ) : isLoading ? (
          <SkeletonCards count={3} height="h-40" />
        ) : rules.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Gift className="h-6 w-6" />}
                title="Bonus qoidalari yo'q"
                description="Haydovchilarni rag'batlantirish uchun birinchi bonus qoidasini yarating."
                action={
                  <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                    Birinchi qoidani yarating
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rules.map((rule) => (
              <Card key={rule.id} className={rule.status === 'active' ? '' : 'opacity-60'}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-1.5 text-title">
                      <Gift className="h-4 w-4 text-primary" aria-hidden="true" />
                      {rule.name}
                    </CardTitle>
                    <Badge variant={rule.status === 'active' ? 'success' : 'secondary'} dot>
                      {rule.status === 'active' ? 'Faol' : 'Nofaol'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  <Badge variant="info">{ruleTypeLabel[rule.ruleType]}</Badge>
                  <p className="text-body text-muted">
                    Har {rule.tripThreshold} safar uchun{' '}
                    <span className="font-mono font-semibold tabular-nums text-ink">
                      {formatCurrency(rule.bonusAmount)}
                    </span>
                  </p>
                  {rule.serviceType && (
                    <p className="text-caption text-subtle">Xizmat turi: {rule.serviceType}</p>
                  )}
                  <button
                    type="button"
                    className="flex w-full items-center gap-1.5 border-t border-divider pt-2 text-caption text-muted transition-colors duration-fast hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    onClick={() => handleToggle(rule)}
                  >
                    {rule.status === 'active' ? (
                      <ToggleRight className="h-4 w-4 text-primary-text" aria-hidden="true" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-subtle" aria-hidden="true" />
                    )}
                    {rule.status === 'active' ? "O'chirish" : 'Yoqish'}
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yangi bonus qoidasi</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
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
                label="Bonus summasi (UZS)"
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
