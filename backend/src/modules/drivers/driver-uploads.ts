import * as path from 'path';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { Inject, Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';

/**
 * Haydovchi yuklaydigan HAR QANDAY fayl (KYC hujjati ham, davriy tekshiruv
 * fotosi ham) uchun YAGONA saqlash va qabul qilish qoidasi.
 *
 * NEGA alohida fayl: bu qoidalar ilgari `driver-documents.controller.ts`
 * ichida edi. Davriy tekshiruv uchun ikkinchi yuklash nuqtasi paydo
 * bo'lgach, ular ko'chirib yozilsa — bir kuni MIME ro'yxati bir joyda
 * yangilanib, ikkinchisida eskiligicha qolardi va "hujjatga ruxsat
 * berilmagan tur" fotoga jimgina o'tib ketardi. Bitta manba = bitta qoida.
 *
 * Fayl qayerda turishini `StorageModule` hal qiladi (`STORAGE_DRIVER`):
 * lokal disk yoki S3-mos bucket (Cloudflare R2, Railway Bucket, MinIO).
 * Bu fayl faqat kalit va tekshiruv qoidalarini biladi.
 */

// Bazaga yoziladigan yo'l prefiksi. `fileUrl` HECH QACHON to'g'ridan-to'g'ri
// o'qish uchun ishlatilmaydi — u shunchaki opaque yozuv, undan faqat
// `basename` olinadi. Prefiks eski qatorlar bilan bir xil qoladi, ya'ni
// hech qanday ma'lumot ko'chirish kerak emas.
export const DRIVER_UPLOAD_URL_PREFIX = '/uploads/driver-documents';

/** Bucket/diskdagi kalit prefiksi — lokal drayverda `uploads/driver-documents/`. */
const STORAGE_KEY_PREFIX = 'driver-documents';

export const DRIVER_UPLOAD_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const DRIVER_UPLOAD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const EXTENSION_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

const FALLBACK_MIME_TYPE = 'application/octet-stream';

// Multer memoryStorage bergan fayl. Ataylab minimal shakl (to'liq
// `Express.Multer.File` emas), shunda servislar HTTP/multipart qatlamiga
// bog'lanib qolmaydi.
export interface UploadedMemoryFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/** Ruxsat berilgan chaqiruvchiga oqim bilan qaytariladigan fayl. */
export interface DriverUploadFile {
  stream: Readable;
  filename: string;
  mimeType: string;
}

/**
 * Ikkala yuklash nuqtasi ham AYNAN shu sozlamani ishlatadi: bir xil o'lcham
 * chegarasi, bir xil MIME ro'yxati.
 *
 * memoryStorage: fayl 10 MB bilan cheklangan, keyin bucket'ga bir marta
 * yoziladi. Diskka vaqtinchalik yozish Railway'da ma'nosiz (disk baribir
 * o'chadi) va tozalanmay qolgan yarim fayllar qoldirardi.
 */
export const driverUploadMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: DRIVER_UPLOAD_MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!DRIVER_UPLOAD_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(
        new UnsupportedMediaTypeException(
          `Unsupported file type "${file.mimetype}". Allowed: ${DRIVER_UPLOAD_ALLOWED_MIME_TYPES.join(', ')}`,
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

/**
 * Faylning HAQIQIY turini birinchi baytlaridan aniqlaydi.
 *
 * `Content-Type` sarlavhasini mijoz yozadi — `evil.html` ni `image/png` deb
 * yuborish bir qator kod. Menejer paneli bu faylni `inline` ochadi, shuning
 * uchun tur mijoz aytganidan emas, tarkibdan olinadi.
 */
export function sniffDriverUploadMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

/** Saqlangan fayl nomidan MIME turini tiklaydi. */
export function driverUploadMimeType(filename: string): string {
  return EXTENSION_MIME_TYPES[path.extname(filename).toLowerCase()] ?? FALLBACK_MIME_TYPE;
}

/**
 * Bazadagi `fileUrl` dan saqlash kalitini tiklaydi. Qiymat HECH QACHON
 * to'g'ridan-to'g'ri kalit bo'lmaydi: faqat uning `basename` i olinadi va u
 * biz yaratgan shaklga (`<uuid>.<ext>`) mos kelishi shart. Shuning uchun
 * `../../etc/passwd` ham, absolyut yo'l ham prefiksdan chiqa olmaydi.
 */
export function driverUploadKey(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  const filename = path.basename(fileUrl);
  if (!/^[A-Za-z0-9_-]+\.[a-z0-9]{2,5}$/.test(filename)) return null;
  return `${STORAGE_KEY_PREFIX}/${filename}`;
}

@Injectable()
export class DriverUploadsStore {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  /**
   * Faylni tekshiradi, saqlaydi va bazaga yoziladigan `fileUrl` ni qaytaradi.
   *
   * Fayl nomi ATAYLAB `randomUUID()` + tarkibdan aniqlangan kengaytma:
   * foydalanuvchi bergan nom saqlansa, u yo'l bo'lib ketishi (`../../`) yoki
   * boshqa haydovchining faylini ustiga yozib yuborishi mumkin edi.
   */
  async save(file: UploadedMemoryFile): Promise<string> {
    const actualMime = sniffDriverUploadMime(file.buffer);
    if (!actualMime) {
      throw new UnsupportedMediaTypeException(
        'File content is not a JPEG, PNG, WEBP or PDF',
      );
    }

    const filename = `${randomUUID()}${MIME_EXTENSIONS[actualMime]}`;
    await this.storage.put(`${STORAGE_KEY_PREFIX}/${filename}`, file.buffer, actualMime);
    return `${DRIVER_UPLOAD_URL_PREFIX}/${filename}`;
  }

  /** `fileUrl` dan haqiqiy faylni topadi; topilmasa `null`. */
  async open(fileUrl: string | null | undefined): Promise<DriverUploadFile | null> {
    const key = driverUploadKey(fileUrl);
    if (!key) return null;

    const object = await this.storage.get(key);
    if (!object) return null;

    const filename = path.basename(key);
    return { stream: object.stream, filename, mimeType: driverUploadMimeType(filename) };
  }
}
