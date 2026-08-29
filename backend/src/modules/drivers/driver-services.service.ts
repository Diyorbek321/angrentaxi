import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Driver } from '../../database/entities/driver.entity';
import { Order, OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { resolveDriverServiceTypes } from './driver-capabilities';
import { DRIVER_SERVICE_CATALOG, driverServiceLabel } from './driver-service-catalog';
import {
  DriverVerificationService,
  UnmetServiceRequirement,
  VerificationDriver,
} from './driver-verification.service';

/** `GET/PATCH /drivers/me/services` javobidagi bitta element. */
export interface DriverServiceOption {
  serviceType: ServiceType;
  label: string;
  description: string;
  enabled: boolean;
  canEnable: boolean;
  blockedReason: string | null;
  // Tekshiruv tizimidagi `code` qiymatlari — mobil ilova shu kodlar orqali
  // to'g'ridan-to'g'ri kerakli kartochkani ocha oladi.
  missingRequirements: string[];
}

/** `GET/PATCH /drivers/me/services` javobi. */
export interface DriverServicesSummary {
  enabled: ServiceType[];
  options: DriverServiceOption[];
}

/**
 * Haydovchi AYNAN SHU paytda bajarayotgan buyurtma holatlari.
 *
 * `SEARCHING` ATAYLAB yo'q: u holatdagi buyurtmada haydovchi hali
 * biriktirilmagan (`driver_id` bo'sh yoki taklif hali qabul qilinmagan),
 * demak xizmatni o'chirish hech kimning ishini yarim yo'lda qoldirmaydi.
 */
const DRIVER_BUSY_STATUSES: readonly OrderStatus[] = [
  OrderStatus.ACCEPTED,
  OrderStatus.ARRIVED,
  OrderStatus.IN_PROGRESS,
];

/**
 * Haydovchi qaysi xizmat turlarini qabul qilishini boshqaradigan darvoza.
 *
 * NEGA ALOHIDA SERVIS: bu yerda ikki tizim tutashadi — imkoniyat filtri
 * (`driver-capabilities.ts`, matching o'qiydi) va davriy tekshiruv
 * (`driver-verification.service.ts`). Mantiq `DriversService` ichiga
 * qo'yilganda u allaqachon 600 qatorlik faylni yana kattalashtirardi va
 * profil yangilash bilan tekshiruv qoidalari bir joyda chalkashardi.
 */
@Injectable()
export class DriverServicesService {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    // Faol buyurtma tekshiruvi uchun. ATAYLAB `OrdersService` emas, balki
    // to'g'ridan-to'g'ri repozitoriy: `OrdersModule` matching orqali
    // `DriversModule` ga bog'langan, servisni olish aylanma bog'liqlikni
    // yasagan bo'lardi. Kerak bo'lgan narsa — bitta `count` so'rovi.
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly verificationService: DriverVerificationService,
  ) {}

  async getForUser(userId: string, now: Date = new Date()): Promise<DriverServicesSummary> {
    const driver = await this.findDriverByUserId(userId);
    return this.getForDriver(driver, now);
  }

  /**
   * Haydovchi tanlovini almashtiradi.
   *
   * Tekshiruvlar tartibi ataylab: avval "hozir band emasmisan" (haydovchi
   * shu zahoti tuzata olmaydigan holat), keyin "yoqishga haqing bormi".
   */
  async updateForUser(
    userId: string,
    requested: ServiceType[],
    now: Date = new Date(),
  ): Promise<DriverServicesSummary> {
    const driver = await this.findDriverByUserId(userId);

    // Takrorlar tashlanadi, lekin tartib DTO dagicha qoladi.
    const next = [...new Set(requested)];

    // ⚠️ Bo'sh ro'yxat rad etiladi. Uni `['taxi']` ga aylantirish ham,
    // saqlab qo'yish ham yomon: birinchisi haydovchi so'ramagan xizmatni
    // yoqib qo'yardi, ikkinchisi esa uni hech qanday buyurtma kelmaydigan
    // holatga tushirib, sababini aytmasdan qoldirardi.
    if (next.length === 0) {
      throw new BadRequestException(
        "Kamida bitta xizmat turi tanlanishi shart — aks holda sizga hech qanday buyurtma kelmaydi.",
      );
    }

    const current = resolveDriverServiceTypes(driver.serviceTypes);
    const removed = current.filter((serviceType) => !next.includes(serviceType));
    await this.assertNoActiveOrders(driver.id, removed);

    for (const serviceType of next) {
      const unmet = await this.verificationService.findUnmetRequirementsForServiceType(
        driver,
        serviceType,
        now,
      );
      if (unmet.length > 0) {
        throw new BadRequestException(this.buildEnableRejection(serviceType, unmet));
      }
    }

    // Immutabl yangilash: mavjud obyekt o'zgartirilmaydi.
    const saved = await this.driverRepository.save({ ...driver, serviceTypes: next });
    return this.getForDriver(saved, now);
  }

  // ------------------------------------------------------------- hisoblash

  private async getForDriver(
    driver: VerificationDriver,
    now: Date,
  ): Promise<DriverServicesSummary> {
    const enabled = [...resolveDriverServiceTypes(driver.serviceTypes)];

    const options: DriverServiceOption[] = [];
    for (const entry of DRIVER_SERVICE_CATALOG) {
      const unmet = await this.verificationService.findUnmetRequirementsForServiceType(
        driver,
        entry.serviceType,
        now,
      );
      options.push({
        serviceType: entry.serviceType,
        label: entry.label,
        description: entry.description,
        enabled: enabled.includes(entry.serviceType),
        // ⚠️ Yoqilgan xizmat ham `canEnable: false` bo'lishi mumkin (masalan
        // termo-sumka fotosining muddati o'tgan). Bu ataylab: GET va PATCH
        // BIR XIL qoidaga tayanadi, shuning uchun ilovadagi tugma holati
        // so'rov natijasini aniq bashorat qiladi. Aks holda ilova "yoqish
        // mumkin" deb ko'rsatib, PATCH da 400 olardi.
        canEnable: unmet.length === 0,
        blockedReason: unmet.length === 0 ? null : this.buildBlockedReason(unmet),
        missingRequirements: unmet.map((item) => item.code),
      });
    }

    return { enabled, options };
  }

  private async findDriverByUserId(userId: string): Promise<Driver> {
    const driver = await this.driverRepository.findOne({ where: { userId } });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    return driver;
  }

  /**
   * O'chirilayotgan turlar bo'yicha yarim yo'ldagi ish bor-yo'qligi.
   *
   * Bitta so'rov bilan: `IN (...)` — o'chirilayotgan turlar odatda bitta,
   * lekin haydovchi bir vaqtda bir nechtasini olib tashlashi mumkin va
   * har biri uchun alohida `count` qilish keraksiz aylanma bo'lardi.
   */
  private async assertNoActiveOrders(
    driverId: string,
    removed: readonly ServiceType[],
  ): Promise<void> {
    if (removed.length === 0) {
      return;
    }

    const busy = await this.orderRepository.find({
      where: {
        driverId,
        serviceType: In([...removed]),
        status: In([...DRIVER_BUSY_STATUSES]),
      },
      select: ['id', 'serviceType'],
      take: 1,
    });

    const blocking = busy[0];
    if (blocking) {
      const label = driverServiceLabel(blocking.serviceType);
      throw new BadRequestException(
        `«${label}» xizmatini o'chirib bo'lmaydi: hozir shu turdagi faol buyurtmani bajaryapsiz. Avval buyurtmani yakunlang.`,
      );
    }
  }

  /** Kontraktdagi qisqa sabab: «Termo-sumka fotosi tasdiqlanmagan». */
  private buildBlockedReason(unmet: UnmetServiceRequirement[]): string {
    return `${unmet.map((item) => item.label).join(', ')} tasdiqlanmagan`;
  }

  /**
   * PATCH rad etish matni. Qaysi TUR va NIMA yetishmayotgani — ikkalasi
   * ham aytiladi, aks holda bir nechta tur yuborilganda haydovchi qaysi
   * biri sabab bo'lganini topa olmaydi.
   */
  private buildEnableRejection(
    serviceType: ServiceType,
    unmet: UnmetServiceRequirement[],
  ): string {
    const label = driverServiceLabel(serviceType);
    return (
      `«${label}» xizmatini yoqib bo'lmadi: ${this.buildBlockedReason(unmet)}. ` +
      "Ilovadagi «Tekshiruv» bo'limidan yuklang."
    );
  }
}
