import type { Promotion, PromotionPayload } from '@/lib/promotions';

/**
 * Aksiya ekranini vendorga moslash: restoran — "taom/menyu", market —
 * "mahsulot/katalog". Komponentlar restoran va market panellarida bir xil.
 * So'z birikmalari TO'LIQ beriladi (o'zak + qo'shimcha yopishtirilmaydi):
 * ruschada kelishiklar boshqacha. Panel lug'atidan olinadi (`t().promotions.vocab`).
 */
export interface PromotionVocabulary {
  /** "Butun menyu" / "Butun katalog" */
  allItems: string;
  /** "Tanlangan taomlar" — qamrov segmenti */
  selectedItems: string;
  /** "taomlar" — pozitsiyalar ro'yxati sarlavhasi (sr-only) */
  itemsLegend: string;
  /** "3 ta taom" (son allaqachon formatlangan) */
  itemCount: (n: string) => string;
  /** "Koʻrish uchun taom" — narx ko'rinishi selektori */
  previewSelect: string;
  /** Qamrovda pozitsiya yo'q — narx ko'rinishi */
  previewEmpty: string;
  /** Summa chegirmasi maydoni izohi */
  fixedHint: string;
  searchPlaceholder: string;
  searchAria: string;
  /** "Katalogda taom yoʻq." */
  catalogEmpty: string;
  /** Birinchi aksiya bo'sh holati izohi */
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
