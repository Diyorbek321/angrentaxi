import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';
import { SettingsService } from '../settings/settings.service';
import {
  batchDeleteSql,
  EXPIRED_INCIDENT_PHOTOS_SQL,
  OLD_SHARE_LINKS_SQL,
  RETENTION_BATCH_SIZE,
  RETENTION_MAX_BATCHES,
  RETENTION_TABLES,
} from './evidence-retention';

export interface RetentionReport {
  retentionDays: number;
  deleted: Record<string, number>;
  incidentPhotos: number;
  failedPhotoKeys: number;
}

/**
 * Kunlik: muddati o'tgan dalillarni o'chiradi (INCIDENT-POLICY §6) —
 * GPS izi, safar chati, yopilgan SOS, qo'ng'iroq jurnali, ulashish
 * havolalari, yopilgan hodisalarning fotolari. Ochiq (yoki yaqinda yopilgan)
 * hodisaga bog'langan safarlarniki qoladi. Moliyaviy yozuvlarga, buyurtma
 * va hodisa qatorlarining o'ziga tegilmaydi.
 */
@Injectable()
export class EvidenceRetentionService {
  private readonly logger = new Logger(EvidenceRetentionService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly settingsService: SettingsService,
    @Optional() @Inject(OBJECT_STORAGE) private readonly storage?: ObjectStorage,
  ) {}

  @Cron('30 3 * * *', { name: 'evidence-retention', timeZone: 'Asia/Tashkent' })
  async scheduled(): Promise<void> {
    try {
      await this.purge();
    } catch (error) {
      this.logger.error(`Evidence retention failed: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  async purge(): Promise<RetentionReport> {
    if (this.running) {
      this.logger.warn('Evidence retention already running — skipped');
      return { retentionDays: 0, deleted: {}, incidentPhotos: 0, failedPhotoKeys: 0 };
    }
    this.running = true;
    try {
      const { evidenceRetentionDays: days } = await this.settingsService.getSafetyPolicySettings();
      const deleted: Record<string, number> = {};
      for (const table of RETENTION_TABLES) {
        deleted[table.table] = await this.deleteInBatches(batchDeleteSql(table), days);
      }
      deleted.trip_share_links = await this.count(OLD_SHARE_LINKS_SQL, [days]);
      const photos = await this.purgeIncidentPhotos(days);
      const report = { retentionDays: days, deleted, ...photos };
      this.logger.log(`Evidence retention (${days} d): ${JSON.stringify(report)}`);
      return report;
    } finally {
      this.running = false;
    }
  }

  private async deleteInBatches(sql: string, days: number): Promise<number> {
    let total = 0;
    for (let batch = 0; batch < RETENTION_MAX_BATCHES; batch += 1) {
      const removed = await this.count(sql, [days, RETENTION_BATCH_SIZE]);
      total += removed;
      if (removed < RETENTION_BATCH_SIZE) break;
    }
    return total;
  }

  private async count(sql: string, params: unknown[]): Promise<number> {
    const rows = (await this.dataSource.query(sql, params)) as Array<{ deleted: number | string }>;
    return Number(rows?.[0]?.deleted ?? 0);
  }

  /**
   * Avval obyekt, keyin kalit ro'yxatdan: o'chmagan obyekt kaliti ro'yxatda
   * qoladi va ertaga qayta urinadi (yetim fayl qolmaydi).
   */
  private async purgeIncidentPhotos(days: number): Promise<{ incidentPhotos: number; failedPhotoKeys: number }> {
    let removed = 0;
    let failed = 0;
    for (let batch = 0; batch < RETENTION_MAX_BATCHES; batch += 1) {
      const rows = (await this.dataSource.query(EXPIRED_INCIDENT_PHOTOS_SQL, [days, RETENTION_BATCH_SIZE])) as Array<{
        id: string;
        photo_keys: unknown;
      }>;
      if (!rows.length) break;
      let progressed = false;
      for (const row of rows) {
        const keys = Array.isArray(row.photo_keys) ? row.photo_keys.filter((k): k is string => typeof k === 'string') : [];
        const kept: string[] = [];
        for (const key of keys) {
          try {
            await this.storage?.delete(key);
            removed += 1;
          } catch (error) {
            failed += 1;
            kept.push(key);
            this.logger.warn(`Incident photo ${key} not deleted: ${(error as Error).message}`);
          }
        }
        if (kept.length < keys.length) progressed = true;
        await this.dataSource.query(`UPDATE incidents SET photo_keys = $2::jsonb WHERE id = $1`, [
          row.id,
          JSON.stringify(kept),
        ]);
      }
      // Hech biri o'chmagan bo'lsa (saqlash ishlamayapti) — aylanib qolmaymiz.
      if (!progressed || rows.length < RETENTION_BATCH_SIZE) break;
    }
    return { incidentPhotos: removed, failedPhotoKeys: failed };
  }
}
