import type { Promotion, PromotionPayload } from '@/lib/promotions';

/**
 * Aksiya ekranini vendorga moslash: restoran — "taom/menyu", market —
 * "mahsulot/katalog". To'liq iboralar (so'z qo'shimchalari tilga bog'liq —
 * ruschada "${item}lar" yasab bo'lmaydi); qiymat panel lug'atidan
 * (`t().promotions.vocab`).
 */
export interface PromotionVocabulary {
  /** "Butun katalog" */
  allItems: string;
  /** "Tanlangan mahsulotlar" — qamrov segmenti. */
  selectedItems: string;
  /** "mahsulotlar" — fieldset legend. */
  itemsLegend: string;
  /** "mahsulot nomi…" */
  itemNamePlaceholder: string;
  /** "mahsulotlarni qidirish" */
  searchItemsAria: string;
  /** "Koʻrish uchun mahsulot" */
  previewItemAria: string;
  /** "N ta mahsulot" (N — formatlangan son). */
  itemCount: (n: string) => string;
  /** Summa chegirmasi maslahati. */
  fixedHint: string;
  /** "Katalogda mahsulot yoʻq." */
  noItemsInCatalog: string;
  /** Narx ko'rinishi: qamrov bo'sh. */
  emptyCoverage: string;
  /** Birinchi aksiya bo'sh holati tavsifi. */
  emptyDescription: string;
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
