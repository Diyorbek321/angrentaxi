import { Store } from '../../database/entities/store.entity';

/**
 * Xaridorga ko'rinadigan do'kon maydonlari — ANIQ ro'yxat.
 *
 * ⚠️ Ilgari vitrina do'kon yozuvini butunligicha qaytarardi: STIR, egasining
 * ID'si, ichki telefon, komissiya stavkasi — har qanday xaridor ko'ra olardi.
 * Yangi ustun qo'shilsa, u bu yerga ATAYLAB yozilmaguncha tashqariga chiqmaydi.
 */
export interface PublicStore {
  id: string;
  name: string;
  address: string | null;
  imageKey: string | null;
  lat: number | null;
  lng: number | null;
  workingHoursStart: string;
  workingHoursEnd: string;
  deliveryMode: Store['deliveryMode'];
  status: Store['status'];
}

export function toPublicStore(store: Store): PublicStore {
  return {
    id: store.id,
    name: store.name,
    address: store.address,
    imageKey: store.imageKey,
    lat: store.lat,
    lng: store.lng,
    workingHoursStart: store.workingHoursStart,
    workingHoursEnd: store.workingHoursEnd,
    deliveryMode: store.deliveryMode,
    status: store.status,
  };
}
