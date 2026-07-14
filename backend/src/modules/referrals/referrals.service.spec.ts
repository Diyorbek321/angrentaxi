import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { Transaction } from '../../database/entities/transaction.entity';

/**
 * Coverage for ReferralsService: applyReferralCode's validation rules
 * (self-referral, already-referred, unknown code, happy path) and
 * getMyReferralInfo's counting/summing logic.
 */
describe('ReferralsService', () => {
  let service: ReferralsService;
  let users: User[];
  let userRepository: {
    findOne: jest.Mock;
    count: jest.Mock;
    save: jest.Mock;
  };
  let transactionRepository: { createQueryBuilder: jest.Mock };
  let sumTotal: string | null;

  function makeUser(overrides: Partial<User>): User {
    return {
      id: 'user-id',
      phone: '+998900000000',
      firstName: null,
      lastName: null,
      role: UserRole.PASSENGER,
      status: UserStatus.ACTIVE,
      blockReason: null,
      fcmToken: null,
      referralCode: 'AAAAAA',
      referredByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as User;
  }

  beforeEach(async () => {
    users = [];
    sumTotal = '0';

    userRepository = {
      findOne: jest.fn(async ({ where }: { where: Partial<User> }) => {
        if (where.id !== undefined) {
          return users.find((u) => u.id === where.id) ?? null;
        }
        if (where.referralCode !== undefined) {
          return users.find((u) => u.referralCode === where.referralCode) ?? null;
        }
        return null;
      }),
      count: jest.fn(async ({ where }: { where: Partial<User> }) => {
        return users.filter((u) => u.referredByUserId === where.referredByUserId).length;
      }),
      save: jest.fn(async (user: User) => {
        const idx = users.findIndex((u) => u.id === user.id);
        if (idx >= 0) users[idx] = user;
        return user;
      }),
    };

    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(async () => ({ total: sumTotal })),
    };
    transactionRepository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
      ],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
  });

  describe('applyReferralCode', () => {
    it('rejects applying your own referral code', async () => {
      const caller = makeUser({ id: 'caller-1', referralCode: 'SELF01' });
      users.push(caller);

      await expect(service.applyReferralCode('caller-1', 'SELF01')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects applying a code when the account already has a referrer', async () => {
      const referrer = makeUser({ id: 'referrer-1', referralCode: 'REF001' });
      const caller = makeUser({
        id: 'caller-1',
        referralCode: 'CALLER',
        referredByUserId: 'someone-else',
      });
      users.push(referrer, caller);

      await expect(service.applyReferralCode('caller-1', 'REF001')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an unknown referral code', async () => {
      const caller = makeUser({ id: 'caller-1', referralCode: 'CALLER' });
      users.push(caller);

      await expect(service.applyReferralCode('caller-1', 'NOPE00')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts a valid code and sets referredByUserId', async () => {
      const referrer = makeUser({ id: 'referrer-1', referralCode: 'REF001' });
      const caller = makeUser({ id: 'caller-1', referralCode: 'CALLER' });
      users.push(referrer, caller);

      const result = await service.applyReferralCode('caller-1', 'REF001');

      expect(result.referredByUserId).toBe('referrer-1');
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'caller-1', referredByUserId: 'referrer-1' }),
      );
    });

    it('throws if the calling user does not exist', async () => {
      await expect(service.applyReferralCode('missing-user', 'REF001')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyReferralInfo', () => {
    it('throws if the user does not exist', async () => {
      await expect(service.getMyReferralInfo('missing-user')).rejects.toThrow(NotFoundException);
    });

    it('returns the referral code, referred count, and summed bonus', async () => {
      const referrer = makeUser({ id: 'referrer-1', referralCode: 'REF001' });
      users.push(referrer);
      users.push(makeUser({ id: 'friend-1', referredByUserId: 'referrer-1' }));
      users.push(makeUser({ id: 'friend-2', referredByUserId: 'referrer-1' }));
      users.push(makeUser({ id: 'stranger', referredByUserId: 'someone-else' }));
      sumTotal = '10000';

      const result = await service.getMyReferralInfo('referrer-1');

      expect(result).toEqual({
        referralCode: 'REF001',
        referredCount: 2,
        totalBonusEarned: 10000,
      });
    });

    it('returns zero bonus when no matching credit transactions exist', async () => {
      const referrer = makeUser({ id: 'referrer-1', referralCode: 'REF001' });
      users.push(referrer);
      sumTotal = '0';

      const result = await service.getMyReferralInfo('referrer-1');

      expect(result.totalBonusEarned).toBe(0);
      expect(result.referredCount).toBe(0);
    });
  });
});
