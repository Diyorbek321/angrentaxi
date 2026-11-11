import { createHash, randomUUID } from 'crypto';
import { BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { sniffDriverUploadMime, type UploadedMemoryFile } from '../drivers/driver-uploads';

/**
 * Katalog rasmlari (restoran/do'kon muqovasi, taom, mahsulot).
 *
 * KYC hujjatlaridan farqli, bular ochiq: ilova `Image.network` bilan
 * sarlavhasiz yuklaydi. Shuning uchun ochiq endpoint faqat shu prefiks va
 * shu shakldagi kalitni beradi — boshqa prefikslar (haydovchi hujjatlari)
 * hech qachon shu yo'l orqali chiqmaydi.
 */
export const CATALOG_PREFIX = 'catalog/';

const CATALOG_IMAGE_KEY = /^catalog\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const EXT_BY_MIME: Record<string, '.jpg' | '.png' | '.webp'> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * 2 MB: rasm har bir mijozning menyu/katalog ekranida yuklanadi. Panel
 * yuborishdan oldin o'zi kichraytiradi (1200 px JPEG), shuning uchun oddiy
 * telefon fotosi ham bu chegaraga sig'adi.
 */
export const CATALOG_IMAGE_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export const catalogImageMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: CATALOG_IMAGE_MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!EXT_BY_MIME[file.mimetype]) {
      callback(new UnsupportedMediaTypeException("Rasm JPEG, PNG yoki WEBP bo'lishi kerak"), false);
      return;
    }
    callback(null, true);
  },
};

/**
 * Yuklangan rasm uchun yangi kalit va haqiqiy turi (baytlardan, sarlavhaga
 * ishonilmaydi); rasm bo'lmasa `null`. Kalit har safar yangi UUID — shu
 * sababli ochiq endpoint `immutable` kesh bera oladi.
 */
export function newCatalogImageKey(buffer: Buffer): { key: string; mimeType: string } | null {
  const mimeType = sniffDriverUploadMime(buffer);
  const ext = mimeType ? EXT_BY_MIME[mimeType] : undefined;
  if (!mimeType || !ext) return null;
  return { key: `${CATALOG_PREFIX}${randomUUID()}${ext}`, mimeType };
}

/** Kalitdan MIME turi; kalit biz yaratgan shaklda bo'lmasa `null`. */
export function catalogImageMimeType(key: string): string | null {
  const match = CATALOG_IMAGE_KEY.exec(key);
  return match ? (MIME_BY_EXT[match[1]] ?? null) : null;
}

/** Urug'dan barqaror UUID shaklidagi qator (sha1 bo'lagi). */
export function stableUuid(seed: string): string {
  const h = createHash('sha1').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Urug'dan barqaror kalit. Seed qayta ishga tushganda bir xil kalitga
 * yozadi — omborda nusxalar ko'paymaydi.
 */
export function catalogImageKey(seed: string, ext: '.jpg' | '.png' | '.webp'): string {
  return `${CATALOG_PREFIX}${stableUuid(seed)}${ext}`;
}

/** Multipart'da rasm kelmagan bo'lsa 400 — aks holda `undefined` servisga o'tib ketardi. */
export function requireImage(file: UploadedMemoryFile | undefined): UploadedMemoryFile {
  if (!file) {
    throw new BadRequestException('Rasm yuborilmadi (multipart maydoni "image" kutilgan)');
  }
  return file;
}
