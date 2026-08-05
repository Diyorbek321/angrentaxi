'use client';

import { useEffect, useState } from 'react';
import { Trash2, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { moderationApi, ModeratedProduct, ModeratedDish } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/utils';

type Tab = 'products' | 'dishes';

export default function ModerationPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<ModeratedProduct[]>([]);
  const [dishes, setDishes] = useState<ModeratedDish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [p, d] = await Promise.all([moderationApi.getProducts(), moderationApi.getDishes()]);
      setProducts(p.data.data);
      setDishes(d.data.data);
      setLoadError(null);
    } catch {
      setLoadError("Ro'yxatni yuklashda xatolik");
      toast({ title: 'Xatolik', description: "Ro'yxatni yuklashda xatolik", variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeProduct = async (id: string) => {
    if (!confirm("Bu mahsulotni butunlay o'chirasizmi?")) return;
    try {
      await moderationApi.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "O'chirildi", variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', variant: 'error' });
    }
  };

  const removeDish = async (id: string) => {
    if (!confirm("Bu taomni butunlay o'chirasizmi?")) return;
    try {
      await moderationApi.deleteDish(id);
      setDishes((prev) => prev.filter((d) => d.id !== id));
      toast({ title: "O'chirildi", variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', variant: 'error' });
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Mahsulot/Menyu moderatsiyasi"
        description="Barcha do'kon va restoranlar bo'yicha mahsulot/taomlarni ko'rib chiqish"
        icon={<ShieldCheck className="h-4 w-4" />}
      />

      <div className="space-y-4">
        <Tabs
          ariaLabel="Moderatsiya turi"
          items={[
            { value: 'products', label: 'Mahsulotlar', count: products.length },
            { value: 'dishes', label: 'Taomlar', count: dishes.length },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />

        <Card>
          <CardContent className="p-0">
            {loadError ? (
              <div className="p-4">
                <ErrorState message={loadError} onRetry={load} compact />
              </div>
            ) : isLoading ? (
              <div className="p-4">
                <SkeletonCards count={5} height="h-12" />
              </div>
            ) : tab === 'products' ? (
              products.length === 0 ? (
                <EmptyState
                  compact
                  tone="positive"
                  title="Mahsulotlar topilmadi"
                  description="Ko'rib chiqilishi kerak bo'lgan mahsulot yo'q."
                />
              ) : (
                <div className="divide-y divide-divider">
                  {products.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-body font-medium text-ink">{p.name}</p>
                        <p className="text-caption text-muted">
                          {p.store?.name ?? '—'} · {formatCurrency(p.price)} · {p.status}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => removeProduct(p.id)}
                      >
                        O&apos;chirish
                      </Button>
                    </div>
                  ))}
                </div>
              )
            ) : dishes.length === 0 ? (
              <EmptyState
                compact
                tone="positive"
                title="Taomlar topilmadi"
                description="Ko'rib chiqilishi kerak bo'lgan taom yo'q."
              />
            ) : (
              <div className="divide-y divide-divider">
                {dishes.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-body font-medium text-ink">{d.name}</p>
                      <p className="text-caption text-muted">
                        {d.restaurant?.name ?? '—'} · {formatCurrency(d.price)} ·{' '}
                        {d.isAvailable ? 'mavjud' : 'tugagan'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => removeDish(d.id)}
                    >
                      O&apos;chirish
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
