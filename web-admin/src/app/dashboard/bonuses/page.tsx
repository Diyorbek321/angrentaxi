'use client';

import { useEffect, useState } from 'react';
import { Plus, Gift, ToggleLeft, ToggleRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
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
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BonusRuleForm>({ resolver: zodResolver(bonusRuleSchema) });

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const res = await bonusRulesApi.getAll();
      setRules(res.data.data);
    } catch {
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
    <div>
      <Header title="Haydovchi bonuslari" subtitle="Bonus qoidalarini boshqaring" />
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Yangi qoida
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-sm text-gray-500">Bonus qoidalari yo&apos;q</p>
              <Button className="mt-4" onClick={openCreate}>
                Birinchi qoidani yarating
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rules.map((rule) => (
              <Card key={rule.id} className={rule.status === 'active' ? '' : 'opacity-60'}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-1.5">
                      <Gift className="h-4 w-4 text-yellow-400" />
                      {rule.name}
                    </CardTitle>
                    <Badge variant={rule.status === 'active' ? 'success' : 'secondary'}>
                      {rule.status === 'active' ? 'Faol' : 'Nofaol'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  <Badge variant="info">{ruleTypeLabel[rule.ruleType]}</Badge>
                  <p className="text-sm text-gray-300">
                    Har {rule.tripThreshold} safar uchun{' '}
                    <span className="font-semibold text-gray-100">
                      {formatCurrency(rule.bonusAmount)}
                    </span>
                  </p>
                  {rule.serviceType && (
                    <p className="text-xs text-gray-500">Xizmat turi: {rule.serviceType}</p>
                  )}
                  <button
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors pt-2 border-t border-white/10 w-full"
                    onClick={() => handleToggle(rule)}
                  >
                    {rule.status === 'active' ? (
                      <ToggleRight className="h-4 w-4 text-green-500" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-gray-500" />
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
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-300">
              Qoida turi
              <select
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-yellow"
                {...register('ruleType')}
              >
                <option value="trip_count">Safar soni</option>
                <option value="weekly_goal">Haftalik maqsad</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Safar soni chegarasi"
                type="number"
                placeholder="50"
                error={errors.tripThreshold?.message}
                {...register('tripThreshold')}
              />
              <Input
                label="Bonus summasi (UZS)"
                type="number"
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
