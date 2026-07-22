'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
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

  const load = async () => {
    setIsLoading(true);
    try {
      const [p, d] = await Promise.all([moderationApi.getProducts(), moderationApi.getDishes()]);
      setProducts(p.data.data);
      setDishes(d.data.data);
    } catch {
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
    <div>
      <Header
        title="Mahsulot/Menyu moderatsiyasi"
        subtitle="Barcha do'kon va restoranlar bo'yicha mahsulot/taomlarni ko'rib chiqish"
      />
      <div className="p-6 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('products')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              tab === 'products' ? 'bg-yellow-400/15 text-yellow-400' : 'text-gray-400 bg-white/5'
            }`}
          >
            Mahsulotlar ({products.length})
          </button>
          <button
            onClick={() => setTab('dishes')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              tab === 'dishes' ? 'bg-yellow-400/15 text-yellow-400' : 'text-gray-400 bg-white/5'
            }`}
          >
            Taomlar ({dishes.length})
          </button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : tab === 'products' ? (
              products.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500">Mahsulotlar topilmadi</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {products.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-100">{p.name}</p>
                        <p className="text-xs text-gray-500">
                          {p.store?.name ?? '—'} · {formatCurrency(p.price)} · {p.status}
                        </p>
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => removeProduct(p.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        O&apos;chirish
                      </Button>
                    </div>
                  ))}
                </div>
              )
            ) : dishes.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">Taomlar topilmadi</p>
            ) : (
              <div className="divide-y divide-white/5">
                {dishes.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-100">{d.name}</p>
                      <p className="text-xs text-gray-500">
                        {d.restaurant?.name ?? '—'} · {formatCurrency(d.price)} ·{' '}
                        {d.isAvailable ? 'mavjud' : 'tugagan'}
                      </p>
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => removeDish(d.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
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
