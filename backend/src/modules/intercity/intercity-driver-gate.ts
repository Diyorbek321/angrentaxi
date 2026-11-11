import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES, codedBadRequest, codedForbidden } from '../../common/errors/coded-error';
import { Driver } from '../../database/entities/driver.entity';
import { ServiceType } from '../../database/entities/order.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { User, UserStatus } from '../../database/entities/user.entity';
import { resolveDriverServiceTypes } from '../drivers/driver-capabilities';
import { DriverLegalService } from '../drivers/driver-legal.service';
import { DriverVerificationService } from '../drivers/driver-verification.service';
import { computeWalletBalance } from '../payments/wallet-balance.util';

export type IntercityPublisher = Driver & { user: User };

/**
 * Qatnov e'lon qila oladigan haydovchi — onlayn chiqish darvozasi bilan
 * BIR XIL talablar (`DriversService.setOnlineStatus`), chunki e'lon qilish
 * ham "ishga chiqish": yo'lovchilar shu haydovchiga pul va vaqt ishonadi.
 *
 * Tartib: avval haydovchi darhol tuzata olmaydigan holatlar (bloklangan,
 * tasdiqlanmagan), keyin u o'zi tuzatadiganlari (xizmat, qarz, hujjat).
 */
@Injectable()
export class IntercityDriverGate {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly verification: DriverVerificationService,
    private readonly legal: DriverLegalService,
  ) {}

  async loadPublisher(userId: string, now: Date = new Date()): Promise<IntercityPublisher> {
    const driver = await this.driverRepository.findOne({
      where: { userId },
      relations: { user: true },
    });
    if (!driver) throw new NotFoundException('Driver profile not found');

    if (driver.user?.status === UserStatus.BLOCKED) {
      throw new ForbiddenException('Your account is blocked');
    }
    if (driver.user?.status === UserStatus.PENDING) {
      throw new ForbiddenException('Your account is awaiting admin approval before you can go online');
    }

    if (!resolveDriverServiceTypes(driver.serviceTypes).includes(ServiceType.INTERCITY)) {
      throw codedForbidden(
        ERROR_CODES.intercityServiceNotEnabled,
        "Avval «Xizmatlar» bo'limida «Shaharlararo» ni yoqing",
      );
    }

    // Qarz DAFTARDAN o'qiladi (`setOnlineStatus` dagi bilan bir xil sabab).
    const balance = await computeWalletBalance(this.transactionRepository, userId);
    if (balance < 0) {
      throw codedBadRequest(
        ERROR_CODES.walletNegativeBalance,
        `Hisobingiz manfiy (${balance.toLocaleString('uz-UZ')} so'm). Qatnov e'lon qilish uchun qarzni yoping.`,
        { details: { balance } },
      );
    }

    await this.verification.assertCanGoOnline(driver, now);
    const unmet = await this.verification.findUnmetRequirementsForServiceType(
      driver,
      ServiceType.INTERCITY,
      now,
    );
    if (unmet.length > 0) {
      throw new BadRequestException(
        `Shaharlararo uchun hujjatlar yetishmaydi: ${unmet.map((item) => item.label).join(', ')}`,
      );
    }

    await this.legal.assertCanCarryIntercity(driver, now);
    return driver as IntercityPublisher;
  }
}
