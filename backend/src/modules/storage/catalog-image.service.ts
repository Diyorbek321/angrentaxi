import { Inject, Injectable, Logger, UnsupportedMediaTypeException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { UploadedMemoryFile } from '../drivers/driver-uploads';
import { CATALOG_PREFIX, newCatalogImageKey } from './catalog-images';
import { OBJECT_STORAGE, ObjectStorage } from './object-storage';

/** `image_key` ustuni bor jadvallar (migratsiya 024). */
const CATALOG_TABLES = ['restaurants', 'stores', 'dishes', 'products'] as const;

/**
 * Restoran/do'kon muqovasi, taom va mahsulot rasmini almashtirish va
 * o'chirish — bitta qoida bilan.
 *
 * Tartib: yangi fayl → qator saqlanadi → eski fayl o'chadi. Qator saqlanmasa
 * yangi fayl o'chiriladi (yetim qolmasin); eski faylni o'chirish yiqilsa
 * faqat log yoziladi — sotuvchi uchun rasm baribir almashgan.
 *
 * Eski fayl boshqa qatorda ham ishlatilayotgan bo'lsa (demo seed bir rasmni
 * bir nechta yozuvga beradi) o'chirilmaydi.
 */
@Injectable()
export class CatalogImageService {
  private readonly logger = new Logger(CatalogImageService.name);

  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly dataSource: DataSource,
  ) {}

  /** Yangi rasmni yozadi, [persist] ga kalitni beradi, keyin eskisini o'chiradi. */
  async replace<T>(
    oldKey: string | null,
    file: UploadedMemoryFile,
    persist: (newKey: string) => Promise<T>,
  ): Promise<T> {
    const image = newCatalogImageKey(file.buffer);
    if (!image) {
      throw new UnsupportedMediaTypeException('Fayl JPEG, PNG yoki WEBP rasm emas');
    }
    await this.storage.put(image.key, file.buffer, image.mimeType);

    let result: T;
    try {
      result = await persist(image.key);
    } catch (err) {
      await this.discard(image.key);
      throw err;
    }
    await this.discard(oldKey);
    return result;
  }

  /** Qatordan rasmni olib tashlaydi ([persist] `null` yozadi), keyin faylni o'chiradi. */
  async clear<T>(oldKey: string | null, persist: () => Promise<T>): Promise<T> {
    const result = await persist();
    await this.discard(oldKey);
    return result;
  }

  /**
   * Endi hech bir qator ko'rsatmaydigan faylni o'chiradi. Qator o'chirilgandan
   * KEYIN chaqiriladi. Hech qachon otmaydi.
   */
  async discard(key: string | null | undefined): Promise<void> {
    if (!key || !key.startsWith(CATALOG_PREFIX)) return;
    try {
      if (await this.isReferenced(key)) return;
      await this.storage.delete(key);
    } catch (err) {
      this.logger.warn(`Katalog rasmi (${key}) o'chmadi: ${(err as Error).message}`);
    }
  }

  private async isReferenced(key: string): Promise<boolean> {
    const sql = CATALOG_TABLES.map((t) => `SELECT 1 FROM "${t}" WHERE image_key = $1`).join(
      ' UNION ALL ',
    );
    const rows: unknown[] = await this.dataSource.query(`${sql} LIMIT 1`, [key]);
    return rows.length > 0;
  }
}
