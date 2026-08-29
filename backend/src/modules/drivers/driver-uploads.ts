import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { UnsupportedMediaTypeException } from '@nestjs/common';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/**
 * Haydovchi yuklaydigan HAR QANDAY fayl (KYC hujjati ham, davriy tekshiruv
 * fotosi ham) uchun YAGONA saqlash va qabul qilish qoidasi.
 *
 * NEGA alohida fayl: bu qoidalar ilgari `driver-documents.controller.ts`
 * ichida edi. Davriy tekshiruv uchun ikkinchi yuklash nuqtasi paydo
 * bo'lgach, ular ko'chirib yozilsa — bir kuni MIME ro'yxati bir joyda
 * yangilanib, ikkinchisida eskiligicha qolardi va "hujjatga ruxsat
 * berilmagan tur" fotoga jimgina o'tib ketardi. Bitta manba = bitta qoida.
 */

// PRODUCTION TODO: lokal disk ko'p hostda (Railway) redeploy'dan keyin
// yo'qoladi. S3 ga o'tishda faqat shu katalog + `resolveDriverUploadPath`
// o'zgaradi, yuklash nuqtalari emas.
export const DRIVER_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'driver-documents');

// Bazaga yoziladigan ochiq yo'l prefiksi. `fileUrl` HECH QACHON to'g'ridan
// to'g'ri o'qish uchun ishlatilmaydi (pastdagi resolverga qarang) — u
// shunchaki opaque yozuv. Prefiks eski qatorlar bilan bir xil qoladi, ya'ni
// hech qanday ma'lumot ko'chirish kerak emas.
export const DRIVER_UPLOAD_URL_PREFIX = '/uploads/driver-documents';

export const DRIVER_UPLOAD_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const DRIVER_UPLOAD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const EXTENSION_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

const FALLBACK_MIME_TYPE = 'application/octet-stream';

// Multer diskStorage bergan fayl. Ataylab minimal shakl (to'liq
// `Express.Multer.File` emas), shunda servislar HTTP/multipart qatlamiga
// bog'lanib qolmaydi.
export interface UploadedDiskFile {
  filename: string;
  path: string;
  mimetype: string;
  size: number;
}

/** Ruxsat berilgan chaqiruvchiga oqim bilan qaytariladigan fayl. */
export interface DriverUploadFile {
  absolutePath: string;
  filename: string;
  mimeType: string;
}

// Katalog import paytida yaratiladi: Multer mavjud bo'lmagan katalogga
// yozmoqchi bo'lsa, birinchi yuklashda 500 qaytarardi.
fs.mkdirSync(DRIVER_UPLOAD_DIR, { recursive: true });

/**
 * Ikkala yuklash nuqtasi ham AYNAN shu sozlamani ishlatadi: bir xil katalog,
 * bir xil o'lcham chegarasi, bir xil MIME ro'yxati.
 *
 * Fayl nomi ATAYLAB `randomUUID()`: foydalanuvchi bergan nom saqlansa, u
 * yo'l bo'lib ketishi (`../../`) yoki boshqa haydovchining faylini ustiga
 * yozib yuborishi mumkin edi. Faqat kengaytma o'tkaziladi.
 */
export const driverUploadMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: DRIVER_UPLOAD_DIR,
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: DRIVER_UPLOAD_MAX_FILE_SIZE_BYTES },
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

/** Saqlangan fayl nomidan MIME turini tiklaydi. */
export function driverUploadMimeType(filename: string): string {
  return EXTENSION_MIME_TYPES[path.extname(filename).toLowerCase()] ?? FALLBACK_MIME_TYPE;
}

/**
 * Yo'l chiqib ketishidan (path traversal) himoya. Bazadagi qiymat HECH
 * QACHON `path.join` ga to'g'ridan-to'g'ri berilmaydi: faqat uning
 * `basename` i olinadi va natija baribir yuklash katalogining AYNAN ichida
 * bo'lishi shart. Shuning uchun `../../etc/passwd` ham, `fileUrl` ga
 * yozilgan absolyut yo'l ham katalogdan chiqa olmaydi.
 */
export function resolveDriverUploadPath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) {
    return null;
  }

  const filename = path.basename(fileUrl);
  if (!filename || filename === '.' || filename === '..') {
    return null;
  }

  const absolutePath = path.resolve(DRIVER_UPLOAD_DIR, filename);
  if (!absolutePath.startsWith(DRIVER_UPLOAD_DIR + path.sep)) {
    return null;
  }

  return absolutePath;
}

/** `fileUrl` dan haqiqiy faylni topadi; topilmasa `null`. */
export function readDriverUploadFile(fileUrl: string | null | undefined): DriverUploadFile | null {
  const absolutePath = resolveDriverUploadPath(fileUrl);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return null;
  }

  const filename = path.basename(absolutePath);
  return { absolutePath, filename, mimeType: driverUploadMimeType(filename) };
}
