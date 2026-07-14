import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Transaction, TransactionType } from '../../database/entities/transaction.entity';

export interface MyReferralInfo {
  referralCode: string;
  referredCount: number;
  totalBonusEarned: number;
}

// externalId prefix stamped on the two CREDIT transactions created by
// OrdersService.completeTrip when a referred passenger finishes their first
// trip (see REFERRAL_BONUS_AMOUNT there). Kept in sync manually since the two
// modules don't share a dependency — grep this string if you change either
// side.
const REFERRAL_BONUS_EXTERNAL_ID_PREFIX = 'referral_bonus_';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async getMyReferralInfo(userId: string): Promise<MyReferralInfo> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const referredCount = await this.userRepository.count({
      where: { referredByUserId: userId },
    });

    const sumResult = await this.transactionRepository
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type = :type', { type: TransactionType.CREDIT })
      .andWhere('t.externalId LIKE :prefix', {
        prefix: `${REFERRAL_BONUS_EXTERNAL_ID_PREFIX}%`,
      })
      .getRawOne<{ total: string }>();

    const totalBonusEarned = parseFloat(sumResult?.total ?? '0');

    return {
      referralCode: user.referralCode,
      referredCount,
      totalBonusEarned,
    };
  }

  async applyReferralCode(userId: string, code: string): Promise<User> {
    const caller = await this.userRepository.findOne({ where: { id: userId } });
    if (!caller) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    if (caller.referredByUserId) {
      throw new BadRequestException('A referral code has already been applied to this account');
    }

    const referrer = await this.userRepository.findOne({
      where: { referralCode: code.trim().toUpperCase() },
    });

    if (!referrer) {
      throw new BadRequestException('Invalid referral code');
    }

    if (referrer.id === caller.id) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    const updated = { ...caller, referredByUserId: referrer.id };
    return this.userRepository.save(updated);
  }
}
