import { ServiceType } from '../../database/entities/order.entity';

/**
 * Haydovchiga ko'rsatiladigan xizmat turlari ro'yxati va ularning MATNI.
 *
 * ⚠️ NEGA MATN SERVERDA, MOBILDA EMAS: tekshiruv ro'yxatida qabul qilingan
 * naqshning aynan o'zi — mobil ilovada tarjima jadvali YO'Q. Ilova nomni
 * o'zi yasasa, `ServiceType` ga yangi qiymat qo'shilgan kunda ekranda
 * xom kalit ("market") chiqib qolardi yoki yangi APK kutish kerak bo'lardi.
 *
 * ⚠️ NEGA JADVAL EMAS, KOD: tekshiruv talablaridan farqli, bu ro'yxat
 * ERKIN o'sadigan ro'yxat emas — u `ServiceType` enum'iga qat'iy bog'langan.
 * Bazada saqlansak, yangi enum qiymati matnsiz qolib ketishi mumkin edi;
 * bu yerda esa `Record<ServiceType, ...>` tipi yangi qiymat qo'shilishi
 * bilanoq kompilyatsiyani buzadi va matn yozishga majbur qiladi.
 */
export interface DriverServiceCatalogEntry {
  serviceType: ServiceType;
  label: string;
  description: string;
}

const CATALOG_TEXT: Record<ServiceType, { label: string; description: string }> = {
  [ServiceType.TAXI]: {
    label: 'Taksi',
    description: "Yo'lovchi tashish",
  },
  [ServiceType.CARGO]: {
    label: 'Yuk tashish',
    description: 'Furgon va yuk mashinasi buyurtmalari',
  },
  [ServiceType.FOOD]: {
    label: 'Ovqat yetkazish',
    description: 'Restorandan mijozga',
  },
  [ServiceType.MARKET]: {
    label: 'Market yetkazish',
    description: "Do'kondan mijozga",
  },
};

/**
 * Ko'rsatish tartibi ATAYLAB qo'lda: taksi birinchi (haydovchilarning
 * aksariyati aynan shu bilan boshlaydi), keyin yuk, so'ng yetkazib berish.
 * `Object.values(ServiceType)` ishlatilsa tartib enum e'lonining tasodifiy
 * hosilasi bo'lib qolardi.
 */
const CATALOG_ORDER: readonly ServiceType[] = [
  ServiceType.TAXI,
  ServiceType.CARGO,
  ServiceType.FOOD,
  ServiceType.MARKET,
];

export const DRIVER_SERVICE_CATALOG: readonly DriverServiceCatalogEntry[] = CATALOG_ORDER.map(
  (serviceType) => ({
    serviceType,
    label: CATALOG_TEXT[serviceType].label,
    description: CATALOG_TEXT[serviceType].description,
  }),
);

/** Xatolik matnida xizmat turini odam o'qiydigan nom bilan atash uchun. */
export function driverServiceLabel(serviceType: ServiceType): string {
  return CATALOG_TEXT[serviceType]?.label ?? serviceType;
}
