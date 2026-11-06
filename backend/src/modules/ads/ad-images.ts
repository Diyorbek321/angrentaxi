import { randomUUID } from 'crypto';
import { UnsupportedMediaTypeException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { sniffDriverUploadMime } from '../drivers/driver-uploads';

/**
 * Reklama banneri rasmi uchun qabul qilish qoidalari.
 *
 * Tur baytlardan aniqlanadi (`sniffDriverUploadMime` — bitta manba), lekin
 * bu yerda PDF YO'Q: banner rasm sifatida `Image.network` da ochiladi.
 * 2 MB chegara — banner har bir yo'lovchining bosh ekranida yuklanadi,
 * katta fayl mobil trafikni bekorga yeydi.
 */
export const AD_IMAGE_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const AD_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const AD_IMAGE_KEY = /^ads\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const adImageMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: AD_IMAGE_MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!AD_IMAGE_EXTENSIONS[file.mimetype]) {
      callback(
        new UnsupportedMediaTypeException('Banner rasmi JPEG, PNG yoki WEBP bo\'lishi kerak'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

/** Haqiqiy turi (baytlardan) va yangi saqlash kaliti; rasm bo'lmasa `null`. */
export function adImageKeyFor(buffer: Buffer): { key: string; mimeType: string } | null {
  const mimeType = sniffDriverUploadMime(buffer);
  const ext = mimeType ? AD_IMAGE_EXTENSIONS[mimeType] : undefined;
  if (!mimeType || !ext) return null;
  return { key: `ads/${randomUUID()}${ext}`, mimeType };
}

/** Bazadagi kalitdan MIME turi; kalit biz yaratgan shaklda bo'lmasa `null`. */
export function adImageMimeType(key: string): string | null {
  const match = AD_IMAGE_KEY.exec(key);
  if (!match) return null;
  return { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[match[1]] ?? null;
}
