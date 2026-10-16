import { Restaurant } from '../../database/entities/restaurant.entity';

/**
 * Xaridorga ko'rinadigan restoran maydonlari — ANIQ ro'yxat.
 *
 * ⚠️ Ilgari vitrina restoran yozuvini butunligicha qaytarardi: STIR,
 * egasining ID'si, ichki telefon, komissiya, bildirishnoma sozlamalari —
 * har qanday xaridor ko'ra olardi. Yangi ustun qo'shilsa, u bu yerga
 * ATAYLAB yozilmaguncha tashqariga chiqmaydi (`public-store.ts` bilan bir xil).
 */
export interface PublicRestaurant {
  id: string;
  name: string;
  address: string | null;
  imageKey: string | null;
  lat: number | null;
  lng: number | null;
  hours: Restaurant['hours'];
  deliveryRadiusKm: number;
  status: Restaurant['status'];
}

export function toPublicRestaurant(restaurant: Restaurant): PublicRestaurant {
  return {
    id: restaurant.id,
    name: restaurant.name,
    address: restaurant.address,
    imageKey: restaurant.imageKey,
    lat: restaurant.lat,
    lng: restaurant.lng,
    hours: restaurant.hours,
    deliveryRadiusKm: restaurant.deliveryRadiusKm,
    status: restaurant.status,
  };
}
