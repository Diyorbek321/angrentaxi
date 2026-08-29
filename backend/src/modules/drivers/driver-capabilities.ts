import { ServiceType } from '../../database/entities/order.entity';
import { VehicleType } from '../../database/entities/tariff.entity';

/**
 * Haydovchi imkoniyatlari — "bu haydovchi shu buyurtmani BAJARA OLADIMI?"
 * degan savolning yagona javob beruvchi joyi.
 *
 * Alohida faylda, chunki javobni ikki tomon o'qiydi: `DriversService`
 * (nomzodlarni saralashda) va testlar. Predikat servis ichida qolsa,
 * matching bilan test bir xil qoidani ikki marta yozgan bo'lardi va ular
 * vaqt o'tib ajralib ketardi.
 */

/**
 * Bo'sh `serviceTypes` shu qiymat deb o'qiladi.
 *
 * ⚠️ Bu shunchaki "qulay standart" emas, MIGRATSIYA XAVFSIZLIGI. Ustun
 * qo'shilishidan oldin mavjud bo'lgan har bir haydovchi — taksi haydovchisi.
 * Bo'shlikni "hech nima" deb o'qisak, deploy lahzasida butun mavjud park
 * matching'dan tushib qolardi.
 */
export const DEFAULT_DRIVER_SERVICE_TYPES: readonly ServiceType[] = [ServiceType.TAXI];

/** Buyurtma tomonidan qo'yiladigan talab. Ikkala maydon ham ixtiyoriy. */
export interface DriverCapabilityFilter {
  // Buyurtmaning `service_type` i.
  serviceType?: ServiceType;
  // Buyurtma tarifidagi `vehicle_type`. `null`/`undefined` = transport turi
  // muhim emas (taksi tariflari), ya'ni filtr qo'llanmaydi.
  vehicleType?: VehicleType | null;
}

/** Haydovchidan imkoniyat tekshiruvi uchun kerak bo'ladigan minimal shakl. */
export interface DriverCapabilities {
  serviceTypes?: ServiceType[] | null;
  vehicleType?: VehicleType | null;
}

/**
 * Haydovchining haqiqiy xizmat ro'yxati — bo'sh/yo'q qiymat `['taxi']` ga
 * aylanadi. Migratsiya mavjud qatorlarni to'ldirsa ham, kod tomonida ham
 * zaxira kerak: `synchronize` ishlagan dev bazasi, eski dump'dan tiklangan
 * yozuv yoki DTO orqali bo'sh massiv yuborilgan holat baribir uchraydi.
 */
export function resolveDriverServiceTypes(
  serviceTypes: ServiceType[] | null | undefined,
): readonly ServiceType[] {
  if (!serviceTypes || serviceTypes.length === 0) {
    return DEFAULT_DRIVER_SERVICE_TYPES;
  }
  return serviceTypes;
}

/**
 * Haydovchi berilgan talabga mos keladimi.
 *
 * Transport turi TENGLIK bo'yicha solishtiriladi, "kattaroq bo'lsa ham
 * bo'ladi" degan yumshatish ATAYLAB yo'q: yo'lovchi furgon narxini to'lagan,
 * katta yuk mashinasi esa boshqa tarif bo'yicha ishlaydi — avtomatik
 * "yuqoriga ko'tarish" haydovchini o'zi rozi bo'lmagan narxda ishlatgan
 * bo'lardi.
 */
export function driverMatchesCapabilities(
  driver: DriverCapabilities,
  filter?: DriverCapabilityFilter,
): boolean {
  if (!filter) return true;

  if (
    filter.serviceType !== undefined &&
    !resolveDriverServiceTypes(driver.serviceTypes).includes(filter.serviceType)
  ) {
    return false;
  }

  // `null`/`undefined` talab = transport turi ahamiyatsiz. Faqat aniq tur
  // so'ralganda filtrlaymiz.
  if (filter.vehicleType != null && driver.vehicleType !== filter.vehicleType) {
    return false;
  }

  return true;
}
