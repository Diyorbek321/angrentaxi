import type { Promotion, PromotionPayload } from '@/lib/promotions';

/**
 * Aksiya ekranini vendorga moslash: restoran — "taom/menyu", market —
 * "mahsulot/katalog". Komponentlar restoran va market panellarida bir xil.
 */
export interface PromotionVocabulary {
  /** "taom" / "mahsulot" */
  item: string;
  /** "Butun menyu" / "Butun katalog" */
  allItems: string;
}

export interface PromotionCatalogItem {
  id: string;
  name: string;
  categoryId: string | null;
  price: number;
}

export interface PromotionCatalogCategory {
  id: string;
  name: string;
}

export interface PromotionCatalog {
  categories: PromotionCatalogCategory[];
  items: PromotionCatalogItem[];
}

export interface PromotionsApiLike {
  list: () => Promise<{ data: { data: Promotion[] } }>;
  create: (data: PromotionPayload) => Promise<unknown>;
  update: (id: string, data: Partial<PromotionPayload>) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}
