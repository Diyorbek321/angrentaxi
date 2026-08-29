import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../../database/entities/driver.entity';
import { DriverVerificationRequirement } from '../../database/entities/driver-verification-requirement.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  DriverVerificationItem,
  DriverVerificationService,
} from './driver-verification.service';

/** Bir tick natijasi — testlar va log uchun. */
export interface VerificationReminderResult {
  notifiedDrivers: number;
  failedDrivers: number;
}

// Eslatiladigan holatlar. `missing` ATAYLAB yo'q: hali hech narsa
// yubormagan haydovchi onboarding oqimida allaqachon ko'rsatma oladi, cron
// esa uni har kuni bezovta qilib, eslatmalarni "shovqin" ga aylantirardi.
const REMINDER_STATUSES: ReadonlySet<DriverVerificationItem['status']> = new Set([
  'due_soon',
  'overdue',
]);

/**
 * Kuniga bir marta muddati yaqinlashgan/o'tgan haydovchilarga eslatma.
 *
 * NEGA `DriverVerificationService` dan ALOHIDA fayl: holat hisoblovchi
 * servisga `RealtimeGateway` kirsa, `DriversService → DriverVerificationService
 * → RealtimeGateway → DriversService` degan haqiqiy aylanma bog'liqlik
 * paydo bo'lardi (gateway `DriversService` ni oladi). Xabar yuborish shu
 * yerda qolgani uchun bog'liqlik grafigi bir tomonlama qoladi va
 * `forwardRef` kerak emas.
 */
@Injectable()
export class DriverVerificationRemindersService {
  private readonly logger = new Logger(DriverVerificationRemindersService.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(DriverVerificationRequirement)
    private readonly requirementRepository: Repository<DriverVerificationRequirement>,
    private readonly verificationService: DriverVerificationService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Ertalab 9:00 — haydovchi smenaga chiqishdan oldin ulguradi. Tunda
  // yuborilgan push ertalabgacha bildirishnomalar orasida ko'milib ketardi.
  @Cron(CronExpression.EVERY_DAY_AT_9AM, { name: 'driver-verification-reminders' })
  async handleDailyReminderTick(): Promise<void> {
    try {
      const result = await this.sendReminders();
      if (result.notifiedDrivers > 0 || result.failedDrivers > 0) {
        this.logger.log(
          `Tekshiruv eslatmasi: ${result.notifiedDrivers} haydovchiga yuborildi, ${result.failedDrivers} tasida xato`,
        );
      }
    } catch (err) {
      // Cron'dagi ushlanmagan xato Nest scheduler'ini jim qoldirishi mumkin —
      // bitta buzuq tick BARCHA kelgusi eslatmalarni o'ldirardi
      // (`scheduled-orders.service.ts` dagi bilan bir xil himoya).
      this.logger.error(`Tekshiruv eslatmalari yiqildi: ${err}`);
    }
  }

  /**
   * `now` ATAYLAB parametr: cron'ni soatga bog'lamasdan testdan o'tkazish
   * uchun (`dispatchDueOrders` naqshi).
   */
  async sendReminders(now: Date = new Date()): Promise<VerificationReminderResult> {
    // ⚠️ HIMOYA (a) ning cron tomondagi ko'rinishi: birorta aktiv qoida
    // bo'lmasa, butun haydovchilar jadvalini o'qishning ma'nosi yo'q.
    const activeRequirements = await this.requirementRepository.count({
      where: { isActive: true },
    });
    if (activeRequirements === 0) {
      return { notifiedDrivers: 0, failedDrivers: 0 };
    }

    // Angren miqyosida haydovchilar soni yuzlarda — bir marta to'liq o'qish
    // arzon. Park minglarga yetsa, bu joy sahifalashga o'tishi kerak.
    const drivers = await this.driverRepository.find({ relations: ['user'] });

    let notifiedDrivers = 0;
    let failedDrivers = 0;

    for (const driver of drivers) {
      try {
        const summary = await this.verificationService.getSummaryForDriver(driver, now);
        // Faqat MAJBURIY elementlar: ixtiyoriysi uchun har kuni push yuborish
        // eslatmalarni qadrsizlantiradi va haydovchi hammasini o'chirib
        // qo'yadi.
        const due = summary.items.filter(
          (item) => item.isRequired && REMINDER_STATUSES.has(item.status),
        );
        if (due.length === 0) {
          continue;
        }

        await this.announce(driver, due);
        notifiedDrivers += 1;
      } catch (err) {
        // Bitta haydovchidagi xato QOLGANLARINI to'xtatmasligi kerak.
        failedDrivers += 1;
        this.logger.error(
          `Tekshiruv eslatmasi tayyorlanmadi (driver ${driver.id}): ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    return { notifiedDrivers, failedDrivers };
  }

  /**
   * Ikkita kanal — ikkita ALOHIDA try/catch. Bitta blokda bo'lsa, socket
   * serveridagi nosozlik push'ni ham to'xtatib qo'yardi; holbuki aynan push
   * ilovasi yopiq haydovchiga yetib boradigan yagona kanal
   * (`driver-bonuses.service.ts#announceAward` naqshi).
   */
  private async announce(driver: Driver, due: DriverVerificationItem[]): Promise<void> {
    const hasOverdue = due.some((item) => item.status === 'overdue');

    try {
      this.realtimeGateway.emitToUser(driver.userId, 'verification:due', {
        hasOverdue,
        items: due.map((item) => ({
          code: item.code,
          label: item.label,
          status: item.status,
          daysLeft: item.daysLeft,
        })),
      });
    } catch (err) {
      this.logger.error(
        `Tekshiruv socket eslatmasi ketmadi (driver ${driver.id}): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    try {
      if (driver.user) {
        await this.notificationsService.notifyVerificationDue(
          driver.user,
          due.map((item) => item.label),
          hasOverdue,
        );
      }
    } catch (err) {
      this.logger.error(
        `Tekshiruv push eslatmasi ketmadi (driver ${driver.id}): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }
}
