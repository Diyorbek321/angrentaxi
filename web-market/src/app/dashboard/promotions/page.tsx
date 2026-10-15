'use client';

import { useCallback } from 'react';
import { marketApi, promotionsApi } from '@/lib/api';
import { PromotionsScreen } from '@/components/promotions/PromotionsScreen';
import type { PromotionCatalog, PromotionVocabulary } from '@/components/promotions/types';

const VOCAB: PromotionVocabulary = { item: 'mahsulot', allItems: 'Butun katalog' };

/** Do'kon aksiyalari — docs/specs/food-market-ux-v5.md §4. Katalog — mavjud mahsulot API'si. */
export default function PromotionsPage() {
  const loadCatalog = useCallback(async (): Promise<PromotionCatalog> => {
    const [p, c] = await Promise.all([marketApi.getProducts(), marketApi.getCategories()]);
    return {
      categories: [...c.data.data]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ id, name, emoji }) => ({ id, name: emoji ? `${emoji} ${name}` : name })),
      items: p.data.data
        .filter((x) => x.status !== 'hidden')
        .map(({ id, name, categoryId, price }) => ({ id, name, categoryId, price: Number(price) })),
    };
  }, []);

  return <PromotionsScreen api={promotionsApi} loadCatalog={loadCatalog} vocab={VOCAB} />;
}
