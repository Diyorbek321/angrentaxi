import * as path from 'path';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { Inject, Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';
import { UploadedMemoryFile, sniffDriverUploadMime } from '../drivers/driver-uploads';

/**
 * Hodisa fotolari (≤ 3, INCIDENT-POLICY §3) — KYC bilan bir xil yopiq
 * saqlash (R2 private bucket / lokal disk): ochiq URL yo'q, faqat ruxsat
 * tekshiradigan endpoint orqali oqim. Faqat rasm (PDF emas): menejer
 * paneli uni `<img>` bilan ko'rsatadi.
 */
export const INCIDENT_PHOTO_MAX = 3;
export const INCIDENT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const KEY_PREFIX = 'incident-photos';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXTENSIONS: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MIME_BY_EXT: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const KEY_PATTERN = /^incident-photos\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const incidentPhotoMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: INCIDENT_PHOTO_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!IMAGE_TYPES.includes(file.mimetype)) {
      callback(new UnsupportedMediaTypeException('Faqat JPEG, PNG yoki WEBP rasm yuklash mumkin'), false);
      return;
    }
    callback(null, true);
  },
};

export interface IncidentPhotoFile {
  stream: Readable;
  filename: string;
  mimeType: string;
}

/** Bazadagi kalit biz yaratgan shaklda bo'lishi shart — boshqa prefiksga chiqib bo'lmaydi. */
export function isIncidentPhotoKey(key: unknown): key is string {
  return typeof key === 'string' && KEY_PATTERN.test(key);
}

@Injectable()
export class IncidentPhotosStore {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  /** Tarkibdan turini aniqlaydi (sarlavhaga ishonilmaydi), saqlaydi, kalitni qaytaradi. */
  async save(file: UploadedMemoryFile): Promise<string> {
    const mime = sniffDriverUploadMime(file.buffer);
    if (!mime || !IMAGE_TYPES.includes(mime)) {
      throw new UnsupportedMediaTypeException('Faqat JPEG, PNG yoki WEBP rasm yuklash mumkin');
    }
    const key = `${KEY_PREFIX}/${randomUUID()}${EXTENSIONS[mime]}`;
    await this.storage.put(key, file.buffer, mime);
    return key;
  }

  async open(key: string): Promise<IncidentPhotoFile | null> {
    if (!isIncidentPhotoKey(key)) return null;
    const object = await this.storage.get(key);
    if (!object) return null;
    const filename = path.basename(key);
    return { stream: object.stream, filename, mimeType: MIME_BY_EXT[path.extname(filename)] ?? 'image/jpeg' };
  }
}
