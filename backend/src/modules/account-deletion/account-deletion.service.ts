import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { FoodOrder, FoodOrderStatus } from '../../database/entities/food-order.entity';
import { MarketOrder, MarketOrderStatus } from '../../database/entities/market-order.entity';
import { WithdrawalRequest, WithdrawalStatus } from '../../database/entities/withdrawal-request.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User, UserRole } from '../../database/entities/user.entity';
import { computeWalletBalance } from '../payments/wallet-balance.util';
import { UsersService } from '../users/users.service';
import {
  codedConflict,
  codedForbidden,
  ERROR_CODES,
  type ErrorReason,
} from '../../common/errors/coded-error';

/** O'zi o'chira oladigan rollar. Xodim va sotuvchi hisoblari — admin/support orqali. */
const SELF_DELETABLE_ROLES: readonly UserRole[] = [UserRole.PASSENGER, UserRole.DRIVER];

const TAXI_FINAL: readonly OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.CANCELLED];
const FOOD_FINAL: readonly FoodOrderStatus[] = [FoodOrderStatus.DELIVERED, FoodOrderStatus.CANCELLED];
const MARKET_FINAL: readonly MarketOrderStatus[] = [MarketOrderStatus.DELIVERED, MarketOrderStatus.CANCELLED];

export interface AccountDeletionEligibility {
  canDelete: boolean;
  reasons: ErrorReason[];
}

/**
 * Hisobni o'chirish (Google Play "account deletion" talabi).
 *
 * O'chirish — ANONIMLASHTIRISH, qatorni yo'q qilish emas: safar, to'lov va
 * soliq yozuvlari qonun bo'yicha saqlanadi va ular `users` ga bog'langan.
 * Shaxsni bog'laydigan maydonlar (telefon, ism, push tokeni) tozalanadi,
 * hisob qayta ochilmaydi, barcha sessiyalar bekor qilinadi. Telefon raqami
 * bo'shaydi — o'sha raqam bilan keyin yangi hisob ochish mumkin.
 *
 * Pul yoki faol buyurtma "osilib" qolmasligi uchun o'chirishdan oldin
 * to'siqlar tekshiriladi va HAMMASI birdaniga qaytariladi — foydalanuvchi
 * bir urinishda nimani hal qilishi kerakligini ko'radi.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(FoodOrder) private readonly foodOrders: Repository<FoodOrder>,
    @InjectRepository(MarketOrder) private readonly marketOrders: Repository<MarketOrder>,
    @InjectRepository(WithdrawalRequest) private readonly withdrawals: Repository<WithdrawalRequest>,
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    private readonly users: UsersService,
  ) {}

  async getEligibility(user: User): Promise<AccountDeletionEligibility> {
    if (!SELF_DELETABLE_ROLES.includes(user.role)) {
      return { canDelete: false, reasons: [roleReason()] };
    }
    const reasons = await this.blockingReasons(user);
    return { canDelete: reasons.length === 0, reasons };
  }

  /** Admin — foydalanuvchining tasdiqlangan so'rovi bo'yicha (veb-sahifadagi yo'l). */
  async deleteOnRequest(userId: string, adminId: string): Promise<void> {
    const user = await this.users.findByIdOrThrow(userId);
    await this.deleteOwnAccount(user, adminId);
  }

  async deleteOwnAccount(user: User, actorUserId: string = user.id): Promise<void> {
    if (!SELF_DELETABLE_ROLES.includes(user.role)) {
      throw codedForbidden(ERROR_CODES.accountDeletionNotAllowed, roleReason().message);
    }
    const reasons = await this.blockingReasons(user);
    if (reasons.length > 0) {
      throw codedConflict(ERROR_CODES.accountDeletionBlocked, "Hisobni hozir o'chirib bo'lmaydi", { reasons });
    }

    // Avval anonimlashtirish: shu ondan JwtStrategy hisobni bloklangan deb
    // ko'radi, ya'ni access token ham darhol ishlamay qoladi.
    await this.users.deleteOwnAccount(user.id, actorUserId);
    await this.refreshTokens.update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: new Date() });
    this.logger.log(`Account ${user.id} (${user.role}) deleted by its owner`);
  }

  private async blockingReasons(user: User): Promise<ErrorReason[]> {
    const [taxi, food, market, openWithdrawals, balance] = await Promise.all([
      this.orders.count({
        where: [
          { passengerId: user.id, status: Not(In([...TAXI_FINAL])) },
          { driverId: user.id, status: Not(In([...TAXI_FINAL])) },
        ],
      }),
      this.foodOrders.count({ where: { customerId: user.id, status: Not(In([...FOOD_FINAL])) } }),
      this.marketOrders.count({ where: { customerId: user.id, status: Not(In([...MARKET_FINAL])) } }),
      this.withdrawals.count({
        where: { driverId: user.id, status: In([WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED]) },
      }),
      computeWalletBalance(this.transactions, user.id),
    ]);

    const reasons: ErrorReason[] = [];
    if (taxi + food + market > 0) {
      reasons.push({ code: 'ACTIVE_ORDER', message: 'Faol buyurtmangiz bor — avval uni yakunlang yoki bekor qiling' });
    }
    if (openWithdrawals > 0) {
      reasons.push({ code: 'OPEN_WITHDRAWAL', message: "Pul yechish so'rovingiz ko'rib chiqilmoqda — yakunlanishini kuting" });
    }
    if (balance > 0) {
      reasons.push({ code: 'WALLET_BALANCE_POSITIVE', message: "Hamyoningizda pul bor — avval uni yechib oling" });
    } else if (balance < 0) {
      reasons.push({ code: 'WALLET_DEBT', message: "Platformaga qarzingiz bor — avval uni yoping" });
    }
    return reasons;
  }
}

function roleReason(): ErrorReason {
  return {
    code: 'ROLE_NOT_SELF_DELETABLE',
    message: "Bu turdagi hisobni ilovadan o'chirib bo'lmaydi — qo'llab-quvvatlash xizmatiga murojaat qiling",
  };
}
