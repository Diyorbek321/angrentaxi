/**
 * Katalog rasmi (taom/mahsulot fotosi) — admin tomoni, faqat ko'rish uchun.
 *
 * Backend faylni `catalog/<uuid>.<ext>` kalitida saqlaydi va ochiq
 * `GET /media/<kalit>` orqali beradi; panel uni o'z proksisi orqali ochadi.
 */

/** `lib/api.ts` dagi `API_PROXY_BASE_URL` + backend'ning ochiq media yo'li. */
const MEDIA_BASE = '/api/proxy/media';

export function catalogImageSrc(imageKey: string | null | undefined): string | null {
  return imageKey ? `${MEDIA_BASE}/${imageKey}` : null;
}
