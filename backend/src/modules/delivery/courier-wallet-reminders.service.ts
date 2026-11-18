import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LocalizedPush, localized } from '../notifications/push-text';

/** Sanadan necha kun oldin ogohlantirish boshlanadi. */
export const COURIER_REMINDER_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

const UZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
] as const;

/** Toshkent sanasi bo'yicha `12-dekabr`. */
export function formatUzbekDayMonth(at: Date): string {
  const local = new Date(at.getTime() + TASHKENT_OFFSET_MS);
  return `${local.getUTCDate()}-${UZ_MONTHS[local.getUTCMonth()]}`;
}

// Rus tilida oy qaratqich kelishigida: "12 декабря".
const RU_MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const;

/** Toshkent sanasi bo'yicha `12 декабря`. */
export function formatRussianDayMonth(at: Date): string {
  const local = new Date(at.getTime() + TASHKENT_OFFSET_MS);
  return `${local.getUTCDate()} ${RU_MONTHS_GENITIVE[local.getUTCMonth()]}`;
}

/** Kuryerga hamyon orqali hisob-kitob boshlanishi haqida eslatma. */
export function courierWalletReminderText(from: Date): LocalizedPush {
  return localized({
    uz: {
      title: 'Hamyon orqali hisob-kitob',
      body:
        `${formatUzbekDayMonth(from)}dan restoran/do'kon bilan hisob-kitob hamyon orqali bo'ladi — ` +
        `hamyoningizni to'ldiring`,
    },
    ru: {
      title: 'Расчёты через кошелёк',
      body: `С ${formatRussianDayMonth(from)} расчёты с ресторанами и магазинами идут через кошелёк — пополните кошелёк`,
    },
  });
}

function tashkentDate(at: Date): string {
  return new Date(at.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

export interface CourierReminderResult {
  notified: number;
  skipped?: 'no_date' | 'already_wallet' | 'not_in_window';
}

/**
 * E-tijorat qonuni 23-modda (2026-12-12): shu sanadan sotuvchi bilan hisob-
 * kitob kuryer HAMYONI orqali. Sanadan 14 kun oldin boshlab yetkazish
 * yoqilgan (food/market) faol kuryerlarga kuniga ko'pi bilan bitta push —
 * hamyonni oldindan to'ldirishsin, aks holda o'sha kuni buyurtma ololmaydi
 * (docs/LEGAL-COMPLIANCE.md §16).
 *
 * Idempotent: `courier_wallet_reminders (user_id, reminder_date)` birlamchi
 * kaliti — cron qayta ishga tushsa ham bir kunda bitta push.
 */
@Injectable()
export class CourierWalletRemindersService {
  private readonly logger = new Logger(CourierWalletRemindersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Ertalab 10:00 Toshkent — kuryer ishga chiqqan payt.
  @Cron('0 10 * * *', { name: 'courier-wallet-reminders', timeZone: 'Asia/Tashkent' })
  async handleDailyTick(): Promise<void> {
    try {
      const result = await this.sendReminders();
      if (result.notified > 0) this.logger.log(`Hamyon eslatmasi: ${result.notified} kuryerga yuborildi`);
    } catch (err) {
      // Ushlanmagan xato scheduler'ni jim qoldirmasin.
      this.logger.error(`Kuryer hamyon eslatmalari yiqildi: ${(err as Error).message}`);
    }
  }

  async sendReminders(now: Date = new Date()): Promise<CourierReminderResult> {
    const settings = await this.settingsService.getVendorSettlementSettings();
    if (!settings.vendorWalletSettlementFrom) return { notified: 0, skipped: 'no_date' };
    if (settings.effectiveVendorSettlementMode === 'wallet') return { notified: 0, skipped: 'already_wallet' };

    const from = new Date(settings.vendorWalletSettlementFrom);
    const windowStart = from.getTime() - COURIER_REMINDER_WINDOW_DAYS * DAY_MS;
    if (now.getTime() < windowStart || now.getTime() >= from.getTime()) {
      return { notified: 0, skipped: 'not_in_window' };
    }

    const couriers = (await this.dataSource.query(
      `SELECT d.user_id, u.fcm_token, u.language
         FROM drivers d JOIN users u ON u.id = d.user_id
        WHERE d.service_types ?| ARRAY['food', 'market']
          AND u.status = 'active'`,
      [],
    )) as Array<{ user_id: string; fcm_token: string | null; language: string | null }>;

    const day = tashkentDate(now);
    const text = courierWalletReminderText(from);
    let notified = 0;
    for (const courier of couriers) {
      try {
        const inserted = (await this.dataSource.query(
          `INSERT INTO courier_wallet_reminders (user_id, reminder_date) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING user_id`,
          [courier.user_id, day],
        )) as unknown[];
        if (!Array.isArray(inserted) || inserted.length === 0) continue;
        await this.notificationsService.notifyWalletEvent(
          { id: courier.user_id, fcmToken: courier.fcm_token, language: courier.language } as User,
          text,
          'courier_wallet_settlement_reminder',
          { effectiveFrom: settings.vendorWalletSettlementFrom },
        );
        notified += 1;
      } catch (err) {
        this.logger.error(`Eslatma yuborilmadi (courier ${courier.user_id}): ${(err as Error).message}`);
      }
    }
    return { notified };
  }
}
