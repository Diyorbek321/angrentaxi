import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Driver } from '../../database/entities/driver.entity';
import {
  DriverVerificationKind,
  DriverVerificationRequirement,
} from '../../database/entities/driver-verification-requirement.entity';
import {
  DriverVerificationReviewStatus,
  DriverVerificationSubmission,
} from '../../database/entities/driver-verification-submission.entity';
import { ServiceType } from '../../database/entities/order.entity';
import { VehicleType } from '../../database/entities/tariff.entity';
import { resolveDriverServiceTypes } from './driver-capabilities';
import { UserRole } from '../../database/entities/user.entity';
import {
  DRIVER_UPLOAD_URL_PREFIX,
  DriverUploadFile,
  UploadedDiskFile,
  readDriverUploadFile,
} from './driver-uploads';
import { ReviewDriverVerificationDto } from './dto/review-driver-verification.dto';

/** Kontraktda kelishilgan holatlar to'plami. */
export type DriverVerificationStatus =
  | 'ok'
  | 'due_soon'
  | 'overdue'
  | 'pending_review'
  | 'rejected'
  | 'missing';

/** `GET /drivers/me/verification` javobidagi bitta element. */
export interface DriverVerificationItem {
  code: string;
  label: string;
  hint: string | null;
  kind: DriverVerificationKind;
  status: DriverVerificationStatus;
  validUntil: string | null;
  daysLeft: number | null;
  rejectionReason: string | null;
  isRequired: boolean;
}

/** `GET /drivers/me/verification` javobi. */
export interface DriverVerificationSummary {
  canGoOnline: boolean;
  blockedReason: string | null;
  items: DriverVerificationItem[];
}

/**
 * Xizmat turini YOQISHGA to'sqinlik qilayotgan bitta talab.
 * `label` javobda ko'rsatiladi, `code` esa mobil ilova qaysi kartochkani
 * ochishini bilishi uchun (`missingRequirements`).
 */
export interface UnmetServiceRequirement {
  code: string;
  label: string;
  status: DriverVerificationStatus;
}

/** Menejer navbatidagi bitta yozuv. */
export interface PendingVerificationEntry {
  id: string;
  driverId: string;
  driverName: string | null;
  driverPhone: string | null;
  code: string;
  label: string;
  kind: DriverVerificationKind;
  fileUrl: string;
  submittedAt: string;
}

/**
 * Holat hisoblash uchun haydovchidan kerak bo'ladigan minimal shakl.
 * Butun `Driver` entity emas — shu tufayli testlar bazasiz yoziladi va
 * `setOnlineStatus` allaqachon qo'lida turgan obyektni qayta so'ramaydi.
 */
export interface VerificationDriver {
  id: string;
  vehicleType: VehicleType | null;
  serviceTypes: ServiceType[] | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// "Muddati yaqinlashdi" oynasi. 3 kun — haydovchi foto olib, yuklab,
// ko'rikdan o'tishga ulguradigan eng qisqa oraliq.
export const DUE_SOON_WINDOW_DAYS = 3;

// Onlayn chiqishni bloklaydigan holatlar. `pending_review` ATAYLAB YO'Q:
// haydovchi o'z ishini qilgan, kechikish biz tomondan — buning uchun uni
// ishdan to'xtatish adolatsiz va u hech qanday harakat bilan tuzata olmaydi.
// `due_soon` ham bloklamaydi — u shunchaki ogohlantirish.
const BLOCKING_STATUSES: readonly DriverVerificationStatus[] = ['missing', 'overdue', 'rejected'];

/**
 * Xizmat turini YOQISH uchun yetarli holatlar.
 *
 * ⚠️ ATAYLAB `BLOCKING_STATUSES` ning teskarisi EMAS: bu yerda
 * `pending_review` YETARLI EMAS, holbuki onlayn darvozada u bloklamaydi.
 * Farq qasddan, chunki ikki savol boshqa-boshqa:
 *   · onlayn darvoza ALLAQACHON bor huquqni tortib oladi — ko'rikdagi
 *     kechikish biz tomondan, shuning uchun jazo haydovchiga tushmaydi;
 *   · bu yerda esa YANGI huquq beriladi. Ko'rilmagan faylni "o'tdi" deb
 *     hisoblasak, istalgan odam bo'sh rasm yuklab o'sha zahoti ovqat
 *     yetkazishni yoqib olardi — ya'ni tekshiruv umuman ma'nosiz bo'lardi.
 */
const SERVICE_ENABLE_OK_STATUSES: readonly DriverVerificationStatus[] = ['ok', 'due_soon'];

@Injectable()
export class DriverVerificationService {
  constructor(
    @InjectRepository(DriverVerificationRequirement)
    private readonly requirementRepository: Repository<DriverVerificationRequirement>,
    @InjectRepository(DriverVerificationSubmission)
    private readonly submissionRepository: Repository<DriverVerificationSubmission>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
  ) {}

  // ---------------------------------------------------------------- o'qish

  async getSummaryForUser(userId: string, now: Date = new Date()): Promise<DriverVerificationSummary> {
    const driver = await this.driverRepository.findOne({ where: { userId } });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    return this.getSummaryForDriver(driver, now);
  }

  async getSummaryByDriverId(
    driverId: string,
    now: Date = new Date(),
  ): Promise<DriverVerificationSummary> {
    const driver = await this.driverRepository.findOne({ where: { id: driverId } });
    if (!driver) {
      throw new NotFoundException(`Driver ${driverId} not found`);
    }
    return this.getSummaryForDriver(driver, now);
  }

  /**
   * Haydovchiga qo'llanadigan har bir qoidaga holat beradi va onlayn
   * chiqishga ruxsat bor-yo'qligini aytadi.
   *
   * ⚠️ HIMOYA (a): jadval bo'sh yoki bu haydovchiga birorta qoida
   * qo'llanmasa — `canGoOnline: true`. Foydalanuvchi haqiqiy ro'yxatni hali
   * bermagan; "qoida yo'q" ni "hammasi taqiqlangan" deb o'qish butun parkni
   * deploy lahzasida oflayn qilib qo'yardi. Bo'sh ro'yxat = cheklov yo'q.
   */
  async getSummaryForDriver(
    driver: VerificationDriver,
    now: Date = new Date(),
  ): Promise<DriverVerificationSummary> {
    const requirements = await this.findApplicableRequirements(driver);
    if (requirements.length === 0) {
      return { canGoOnline: true, blockedReason: null, items: [] };
    }

    const submissions = await this.submissionRepository.find({
      where: { driverId: driver.id, code: In(requirements.map((r) => r.code)) },
      order: { submittedAt: 'DESC' },
    });

    const items: DriverVerificationItem[] = [];
    const blockingLabels: string[] = [];

    for (const requirement of requirements) {
      const forCode = submissions.filter((s) => s.code === requirement.code);
      const latest = forCode[0] ?? null;
      const latestApproved =
        forCode.find((s) => s.reviewStatus === DriverVerificationReviewStatus.APPROVED) ?? null;

      const status = this.resolveStatus(latest, now);
      items.push(this.toItem(requirement, latest, status, now));

      if (requirement.isRequired && BLOCKING_STATUSES.includes(status)) {
        const deadline = this.computeBlockDeadline(requirement, latest, latestApproved);
        if (deadline !== null && now.getTime() > deadline.getTime()) {
          blockingLabels.push(requirement.label);
        }
      }
    }

    return {
      canGoOnline: blockingLabels.length === 0,
      blockedReason: blockingLabels.length === 0 ? null : this.buildBlockedReason(blockingLabels),
      items,
    };
  }

  /**
   * `goOnline` uchun darvozabon. Sabab o'zbekcha va aniq: haydovchi nima
   * qilishi kerakligini bir o'qishda tushunishi shart.
   */
  async assertCanGoOnline(driver: VerificationDriver, now: Date = new Date()): Promise<void> {
    const summary = await this.getSummaryForDriver(driver, now);
    if (!summary.canGoOnline) {
      throw new BadRequestException(summary.blockedReason);
    }
  }

  /** Haydovchiga qo'llanadigan aktiv qoidalar, ko'rsatish tartibida. */
  async findApplicableRequirements(
    driver: VerificationDriver,
  ): Promise<DriverVerificationRequirement[]> {
    const active = await this.requirementRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', code: 'ASC' },
    });

    const driverServiceTypes = resolveDriverServiceTypes(driver.serviceTypes);

    // `null` = "hammaga tegishli". Aynan shuning uchun filtr `!= null`
    // tekshiruvi bilan yozilgan: bo'sh qiymat cheklov EMAS.
    return active.filter((requirement) => {
      if (requirement.serviceType != null && !driverServiceTypes.includes(requirement.serviceType)) {
        return false;
      }
      if (requirement.vehicleType != null && driver.vehicleType !== requirement.vehicleType) {
        return false;
      }
      return true;
    });
  }

  /**
   * Berilgan xizmat turini YOQISH uchun bajarilmagan majburiy talablar.
   * Bo'sh massiv = to'siq yo'q.
   *
   * ⚠️ HIMOYA: shu `serviceType` uchun birorta qoida sozlanmagan bo'lsa —
   * bo'sh massiv, ya'ni RUXSAT. "Qoida yo'q" ni "taqiqlangan" deb o'qish
   * foydalanuvchi haqiqiy ro'yxatni bermagan holatda hamma xizmatni
   * bloklab qo'yardi — `getSummaryForDriver` dagi HIMOYA (a) bilan bir xil
   * qoida.
   *
   * ⚠️ FAQAT `service_type = <shu tur>` qatorlari qaraladi; `service_type
   * IS NULL` (hammaga tegishli) qoidalar ATAYLAB hisobga olinmaydi. Ular
   * onlayn darvozaning ishi: pasporti muddati o'tgan haydovchi umuman
   * ishlay olmaydi, lekin bu "ovqat yetkazishni yoqa olmaysan" degani emas
   * — aks holda mavjud `taxi` ham `canEnable: false` bo'lib ko'rinardi va
   * haydovchi hech qachon o'zgartira olmaydigan ekranni ko'rardi.
   *
   * ⚠️ `graceDays` bu yerda QO'LLANMAYDI. U yangi qoida butun parkni
   * oflayn qilib qo'ymasligi uchun kerak; yangi xizmatni yoqishda esa
   * hech kimning mavjud huquqi tortib olinmaydi, demak yumshatishga
   * sabab yo'q.
   */
  async findUnmetRequirementsForServiceType(
    driver: VerificationDriver,
    serviceType: ServiceType,
    now: Date = new Date(),
  ): Promise<UnmetServiceRequirement[]> {
    const forService = await this.requirementRepository.find({
      where: { isActive: true, serviceType },
      order: { sortOrder: 'ASC', code: 'ASC' },
    });

    // Tavsiya etiladigan (`isRequired = false`) qoidalar hech qachon
    // bloklamaydi — onlayn darvozadagi bilan bir xil ma'no.
    const applicable = forService.filter(
      (requirement) =>
        requirement.isRequired &&
        (requirement.vehicleType == null || requirement.vehicleType === driver.vehicleType),
    );
    if (applicable.length === 0) {
      return [];
    }

    const submissions = await this.submissionRepository.find({
      where: { driverId: driver.id, code: In(applicable.map((r) => r.code)) },
      order: { submittedAt: 'DESC' },
    });

    const unmet: UnmetServiceRequirement[] = [];
    for (const requirement of applicable) {
      // `find` — ro'yxat `submittedAt DESC` tartibida, demak birinchisi
      // eng oxirgi yuborilgani (holat hisobi hamma joyda shunga tayanadi).
      const latest = submissions.find((s) => s.code === requirement.code) ?? null;
      const status = this.resolveStatus(latest, now);
      if (!SERVICE_ENABLE_OK_STATUSES.includes(status)) {
        unmet.push({ code: requirement.code, label: requirement.label, status });
      }
    }
    return unmet;
  }

  // ---------------------------------------------------------------- yozish

  /**
   * Haydovchi bitta material yuboradi. Fayl allaqachon diskka yozilgan
   * (Multer), bu yerda faqat yozuv qoladi.
   *
   * Har yuborish — YANGI qator: eskisi ustiga yozilmaydi, shuning uchun
   * "qachon nima yuborilgan" tarixi to'liq saqlanadi.
   */
  async submit(
    userId: string,
    code: string,
    file: UploadedDiskFile,
    now: Date = new Date(),
  ): Promise<DriverVerificationItem> {
    const driver = await this.driverRepository.findOne({ where: { userId } });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const requirement = await this.requirementRepository.findOne({
      where: { code, isActive: true },
    });
    if (!requirement) {
      throw new BadRequestException(`Noma'lum tekshiruv kodi: "${code}"`);
    }

    const submission = await this.submissionRepository.save({
      driverId: driver.id,
      code: requirement.code,
      // Saqlash manzili, ochiq URL emas — fayl faqat ruxsat tekshiradigan
      // endpoint orqali beriladi (KYC hujjatlaridagi bilan bir xil qoida).
      fileUrl: `${DRIVER_UPLOAD_URL_PREFIX}/${file.filename}`,
      reviewStatus: DriverVerificationReviewStatus.PENDING,
      rejectionReason: null,
      reviewedAt: null,
      reviewedBy: null,
      validUntil: null,
    });

    return this.toItem(requirement, submission, 'pending_review', now);
  }

  /** Menejer/admin navbati: ko'rilmagan materiallar, eng eskisi birinchi. */
  async listPending(): Promise<PendingVerificationEntry[]> {
    const submissions = await this.submissionRepository.find({
      where: { reviewStatus: DriverVerificationReviewStatus.PENDING },
      order: { submittedAt: 'ASC' },
    });
    if (submissions.length === 0) {
      return [];
    }

    const requirements = await this.requirementRepository.find({
      where: { code: In([...new Set(submissions.map((s) => s.code))]) },
    });
    const byCode = new Map(requirements.map((r) => [r.code, r]));

    const drivers = await this.driverRepository.find({
      where: { id: In([...new Set(submissions.map((s) => s.driverId))]) },
      relations: ['user'],
    });
    const byDriverId = new Map(drivers.map((d) => [d.id, d]));

    return submissions.map((submission) => {
      const requirement = byCode.get(submission.code);
      const driver = byDriverId.get(submission.driverId);
      const user = driver?.user;
      return {
        id: submission.id,
        driverId: submission.driverId,
        driverName: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || null : null,
        driverPhone: user?.phone ?? null,
        code: submission.code,
        // Qoida keyinchalik o'chirilgan bo'lsa ham navbat ochiq qoladi —
        // shuning uchun `label` uchun zaxira sifatida `code` ishlatiladi.
        label: requirement?.label ?? submission.code,
        kind: requirement?.kind ?? DriverVerificationKind.DOCUMENT,
        fileUrl: submission.fileUrl,
        submittedAt: submission.submittedAt.toISOString(),
      };
    });
  }

  /**
   * Menejer/admin qarori.
   *
   * `validUntil` AYNAN shu yerda tug'iladi: `cadenceDays = 0` bo'lsa `null`
   * (muddatsiz, bir martalik KYC), aks holda `now + cadenceDays`. Hisob
   * yuborilgan paytdan emas, TASDIQLANGAN paytdan boshlanadi — aks holda
   * ko'rikda kechikkan har bir kun haydovchining amal qilish muddatidan
   * o'g'irlangan bo'lardi.
   */
  async review(
    submissionId: string,
    reviewedBy: string,
    dto: ReviewDriverVerificationDto,
    now: Date = new Date(),
  ): Promise<DriverVerificationItem> {
    const submission = await this.submissionRepository.findOne({ where: { id: submissionId } });
    if (!submission) {
      throw new NotFoundException(`Verification submission "${submissionId}" not found`);
    }

    if (submission.reviewStatus !== DriverVerificationReviewStatus.PENDING) {
      throw new BadRequestException(
        `Bu material allaqachon ko'rib chiqilgan (${submission.reviewStatus})`,
      );
    }

    const rejectionReason = dto.rejectionReason?.trim();
    if (!dto.approved && !rejectionReason) {
      // Sababsiz rad etish haydovchiga hech narsa aytmaydi — u nimani
      // tuzatishni bilmasdan aynan o'sha faylni qayta yuboradi.
      throw new BadRequestException('Rad etishda sabab ko‘rsatilishi shart');
    }

    const requirement = await this.requirementRepository.findOne({
      where: { code: submission.code },
    });

    const validUntil =
      dto.approved && requirement && requirement.cadenceDays > 0
        ? new Date(now.getTime() + requirement.cadenceDays * MS_PER_DAY)
        : null;

    const saved = await this.submissionRepository.save({
      ...submission,
      reviewStatus: dto.approved
        ? DriverVerificationReviewStatus.APPROVED
        : DriverVerificationReviewStatus.REJECTED,
      rejectionReason: dto.approved ? null : (rejectionReason as string),
      reviewedAt: now,
      reviewedBy,
      validUntil,
    });

    const fallback: DriverVerificationRequirement = {
      code: saved.code,
      label: saved.code,
      hint: null,
      kind: DriverVerificationKind.DOCUMENT,
      isRequired: true,
    } as DriverVerificationRequirement;

    return this.toItem(requirement ?? fallback, saved, this.resolveStatus(saved, now), now);
  }

  /**
   * Yuborilgan faylni ruxsat tekshirib qaytaradi.
   *
   * Kontraktdagi to'rt endpointdan tashqarida, lekin ularsiz ko'rik oqimi
   * ishlamaydi: `uploads/` katalogi ATAYLAB statik tarqatilmaydi (pasport
   * skanlari) — demak menejer faylni ko'rishning boshqa yo'li yo'q.
   *
   * Ruxsat shu yerda, marshrut qorovuliga qo'shimcha ravishda tekshiriladi:
   * haydovchi faqat O'ZINIKINI, menejer/admin hammasini oladi. Kelajakda
   * `@Roles` kengaysa ham begona odam boshqa haydovchining pasportini
   * ko'ra olmaydi.
   */
  async getFileForDownload(
    submissionId: string,
    requester: { id: string; role: UserRole },
  ): Promise<DriverUploadFile> {
    const submission = await this.submissionRepository.findOne({ where: { id: submissionId } });
    if (!submission) {
      throw new NotFoundException(`Verification submission "${submissionId}" not found`);
    }

    if (requester.role !== UserRole.MANAGER && requester.role !== UserRole.ADMIN) {
      const driver =
        requester.role === UserRole.DRIVER
          ? await this.driverRepository.findOne({ where: { userId: requester.id } })
          : null;
      if (!driver || driver.id !== submission.driverId) {
        throw new ForbiddenException('You may only access your own submissions');
      }
    }

    const file = readDriverUploadFile(submission.fileUrl);
    if (!file) {
      throw new NotFoundException(`File for submission "${submissionId}" is missing`);
    }
    return file;
  }

  // ------------------------------------------------------------- hisoblash

  /**
   * Kontraktdagi holat qoidalari, so'zma-so'z:
   *   missing        → hech qachon yuborilmagan
   *   pending_review → yuborilgan, ko'rilmagan
   *   rejected       → rad etilgan
   *   ok             → tasdiqlangan va muddati hali kelmagan
   *   due_soon       → muddatiga 3 kundan kam qoldi
   *   overdue        → muddati o'tib ketgan
   *
   * Hisob ENG OXIRGI yuborilgan material bo'yicha yuritiladi: haydovchi
   * qayta yuborgan bo'lsa, ko'rilayotgan narsa aynan o'sha yangi fayl.
   */
  private resolveStatus(
    latest: DriverVerificationSubmission | null,
    now: Date,
  ): DriverVerificationStatus {
    if (!latest) return 'missing';
    if (latest.reviewStatus === DriverVerificationReviewStatus.PENDING) return 'pending_review';
    if (latest.reviewStatus === DriverVerificationReviewStatus.REJECTED) return 'rejected';

    // Tasdiqlangan. `validUntil = null` — bir martalik talab, muddatsiz.
    if (!latest.validUntil) return 'ok';

    const remainingMs = latest.validUntil.getTime() - now.getTime();
    if (remainingMs <= 0) return 'overdue';
    if (remainingMs < DUE_SOON_WINDOW_DAYS * MS_PER_DAY) return 'due_soon';
    return 'ok';
  }

  /**
   * ⚠️ HIMOYA (b) — YANGI QOIDA BUTUN PARKNI OFLAYN QILMASLIGI KERAK.
   *
   * Muammo: bugun `driver_verification_requirements` ga yangi qator
   * qo'shilsa, ertaga ertalab har bir haydovchida u `missing` bo'ladi.
   * Agar blok darhol ishlasa, qoida yozilgan soniyada butun park onlayn
   * chiqa olmay qoladi va shahar taksisiz qoladi.
   *
   * Yechim: hisob QOIDA YARATILGAN sanadan boshlanadi, haydovchidan emas.
   * Ya'ni majburlash `requirement.created_at + graceDays` dan oldin
   * BOSHLANMAYDI. Qoida yaratilishidan oldingi hech qanday holat uchun
   * jarima yo'q — `graceDays` aynan "yangi talabga moslashish oynasi".
   * (`graceDays = 7` yozilsa, park bir hafta vaqt oladi.)
   *
   * Qolgan ikki manba shu polning USTIGA qo'shiladi, eng kechi yutadi:
   *   · muddati o'tgan tasdiq  → `validUntil + graceDays`
   *   · rad etilgan material   → `reviewedAt + graceDays`
   *     (haydovchi tuzatib qayta yuborishga vaqt oladi)
   *
   * `null` qaytishi = HECH QACHON bloklanmaydi: haydovchida muddatsiz
   * tasdiq bor (`cadenceDays = 0`). Undan keyingi rad etilgan urinish
   * allaqachon berilgan tasdiqni bekor qilmaydi.
   *
   * ⚠️ ATAYLAB haydovchining ro'yxatdan o'tgan sanasi HISOBGA OLINMAYDI:
   * aks holda yangi kelgan haydovchi hech qanday hujjatsiz `graceDays`
   * davomida ishlay olardi — bu KYC ni teshib o'tish yo'li bo'lardi.
   */
  private computeBlockDeadline(
    requirement: DriverVerificationRequirement,
    latest: DriverVerificationSubmission | null,
    latestApproved: DriverVerificationSubmission | null,
  ): Date | null {
    const graceMs = requirement.graceDays * MS_PER_DAY;
    let deadlineMs = requirement.createdAt.getTime() + graceMs;

    if (latestApproved) {
      if (!latestApproved.validUntil) {
        return null;
      }
      deadlineMs = Math.max(deadlineMs, latestApproved.validUntil.getTime() + graceMs);
    }

    if (
      latest &&
      latest.reviewStatus === DriverVerificationReviewStatus.REJECTED &&
      latest.reviewedAt
    ) {
      deadlineMs = Math.max(deadlineMs, latest.reviewedAt.getTime() + graceMs);
    }

    return new Date(deadlineMs);
  }

  private toItem(
    requirement: DriverVerificationRequirement,
    latest: DriverVerificationSubmission | null,
    status: DriverVerificationStatus,
    now: Date,
  ): DriverVerificationItem {
    const validUntil = latest?.validUntil ?? null;

    return {
      code: requirement.code,
      label: requirement.label,
      hint: requirement.hint ?? null,
      kind: requirement.kind,
      status,
      validUntil: validUntil ? validUntil.toISOString() : null,
      daysLeft: validUntil ? this.daysLeft(validUntil, now) : null,
      rejectionReason: status === 'rejected' ? (latest?.rejectionReason ?? null) : null,
      isRequired: requirement.isRequired,
    };
  }

  /**
   * Qolgan kunlar; manfiy = kechikkan.
   *
   * Ikki tomon HAR XIL yaxlitlanadi va bu ataylab: 12 soat qolganda `1`
   * ("bugun-erta") va 12 soat kechikkanda `-1` chiqadi. Ikkalasida bir xil
   * yaxlitlash ishlatilsa, kechikkan haydovchiga `0` ko'rsatilardi — ya'ni
   * "muddati bugun tugaydi", holbuki u allaqachon o'tib ketgan.
   */
  private daysLeft(validUntil: Date, now: Date): number {
    const diffDays = (validUntil.getTime() - now.getTime()) / MS_PER_DAY;
    return diffDays > 0 ? Math.ceil(diffDays) : Math.floor(diffDays);
  }

  private buildBlockedReason(labels: string[]): string {
    const listed = labels.map((label) => `«${label}»`).join(', ');
    return `Onlayn chiqa olmaysiz: ${listed} — muddati o'tgan yoki yuklanmagan. Ilovadagi «Tekshiruv» bo'limidan yangilang.`;
  }
}
