'use client';

import { useCallback } from 'react';
import { foodApi, promotionsApi } from '@/lib/api';
import { PromotionsScreen } from '@/components/promotions/PromotionsScreen';
import type { PromotionCatalog, PromotionVocabulary } from '@/components/promotions/types';

const VOCAB: PromotionVocabulary = { item: 'taom', allItems: 'Butun menyu' };

/** Restoran aksiyalari — docs/specs/food-market-ux-v5.md §4. Katalog — mavjud menyu API'si. */
export default function PromotionsPage() {
  const loadCatalog = useCallback(async (): Promise<PromotionCatalog> => {
    const [d, c] = await Promise.all([foodApi.getDishes(), foodApi.getCategories()]);
    return {
      categories: [...c.data.data].sort((a, b) => a.sortOrder - b.sortOrder).map(({ id, name }) => ({ id, name })),
      items: d.data.data.map(({ id, name, categoryId, price }) => ({ id, name, categoryId, price: Number(price) })),
    };
  }, []);

  return <PromotionsScreen api={promotionsApi} loadCatalog={loadCatalog} vocab={VOCAB} />;
}
