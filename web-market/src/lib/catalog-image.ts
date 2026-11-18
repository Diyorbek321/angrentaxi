/**
 * Katalog rasmi (muqova, taom/mahsulot fotosi) — panel tomoni.
 *
 * Backend faylni `catalog/<uuid>.<ext>` kalitida saqlaydi va uni ochiq
 * `GET /media/<kalit>` orqali beradi; panel uni o'z proksisi orqali ochadi.
 * Rasm yuborishdan oldin brauzerda 1200 px gacha kichraytiriladi: telefon
 * fotosi 4–8 MB bo'ladi, backend esa 2 MB dan kattasini qabul qilmaydi —
 * va mijoz ilovasi har safar shu faylni yuklaydi.
 */

import { t } from '@/locales';

export const CATALOG_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Tanlangan asl fayl chegarasi — kichraytirishdan oldin. */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
/** Backend chegarasi (`CATALOG_IMAGE_MAX_FILE_SIZE_BYTES`). */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_EDGE_PX = 1200;

/** `lib/api.ts` dagi `API_PROXY_BASE_URL` + backend'ning ochiq media yo'li. */
const MEDIA_BASE = '/api/proxy/media';

/** Formadagi rasm holati: o'zgarmagan / yangisi tanlangan / olib tashlangan. */
export type ImageChange = { kind: 'keep' } | { kind: 'set'; file: File } | { kind: 'remove' };

export function catalogImageSrc(imageKey: string | null | undefined): string | null {
  return imageKey ? `${MEDIA_BASE}/${imageKey}` : null;
}

/** Foydalanuvchiga ko'rsatiladigan xato yoki `null`. */
export function validateCatalogImage(file: { type: string; size: number }): string | null {
  if (!(CATALOG_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return t().catalogImage.badType;
  }
  if (file.size > MAX_SOURCE_BYTES) return t().catalogImage.tooLarge;
  return null;
}

/** Tomonlar nisbatini saqlab, eng uzun tomonni [max] ga tushiradi (kattalashtirmaydi). */
export function fitWithin(width: number, height: number, max = MAX_EDGE_PX): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(t().catalogImage.prepareFailed))),
      'image/jpeg',
      quality
    );
  });
}

/** Brauzerda kichraytirib JPEG qiladi; 2 MB ga sig'masa xato. */
export async function prepareCatalogImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(t().catalogImage.readFailed);
  });
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(t().catalogImage.prepareFailed);
  // PNG shaffof joylari JPEG'da qora bo'lib qolmasin.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await canvasToJpeg(canvas, quality);
    if (blob.size <= MAX_UPLOAD_BYTES) return blob;
  }
  throw new Error(t().catalogImage.tooLargeAfter);
}

/** Backend kutgan multipart: bitta `image` maydoni. */
export async function catalogImageForm(file: File): Promise<FormData> {
  const form = new FormData();
  form.append('image', await prepareCatalogImage(file), 'image.jpg');
  return form;
}
