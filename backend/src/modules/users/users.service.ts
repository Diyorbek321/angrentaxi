import {
  Injectable,
  Logger,
  Optional,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DEFAULT_MANAGER_PERMISSIONS, Permission, User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { generateUniqueReferralCode } from '../../common/utils/referral-code.util';
import type { AppLanguage } from '../../common/i18n/error-messages';
import { AUDIT_ACTIONS, AuditEntryInput, AuditLogService } from '../audit/audit-log.service';

/** Called after a user is blocked; failures are logged, never fail the block. */
export type UserBlockedListener = (userId: string) => Promise<void>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  // Bloklash oqibatlari (haydovchini oflayn qilish, socketlarni uzish)
  // ro'yxatdan o'tgan tinglovchilar orqali: DriversService va RealtimeGateway
  // ikkalasi ham UsersService ga bog'liq — bu yerdan ularni to'g'ridan-to'g'ri
  // chaqirish aylanma bog'liqlik bo'lardi.
  private readonly blockListeners: UserBlockedListener[] = [];

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    // Ixtiyoriy: qo'lda yig'iladigan eski spec'lar jurnalni bilmaydi.
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  /** Batch lookup for lists that show several people at once (one query, not N). */
  async findByIds(ids: readonly string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return this.userRepository.find({ where: { id: In([...ids]) } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phone } });
  }

  // Used by dispatcher-created orders: the passenger may not have ever logged
  // in via OTP yet, so we create their account the same way auth.service does.
  async findOrCreateByPhone(phone: string, fullName?: string): Promise<User> {
    const existing = await this.findByPhone(phone);
    if (existing) return existing;

    const [firstName, ...rest] = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
    const referralCode = await generateUniqueReferralCode(this.userRepository);

    return this.userRepository.save({
      phone,
      role: UserRole.PASSENGER,
      status: UserStatus.ACTIVE,
      firstName: firstName || null,
      lastName: rest.join(' ') || null,
      fcmToken: null,
      referralCode,
      referredByUserId: null,
    });
  }

  // Used by admin-initiated vendor onboarding (Market stores, Restaurants):
  // the phone must not already belong to another account, since a vendor
  // owner account is single-purpose (see Store/Restaurant.ownerUserId unique).
  async createWithRole(
    phone: string,
    role: UserRole,
    firstName?: string,
    lastName?: string,
  ): Promise<User> {
    const existing = await this.findByPhone(phone);
    if (existing) {
      throw new ConflictException('A user with this phone number already exists');
    }
    const referralCode = await generateUniqueReferralCode(this.userRepository);
    return this.userRepository.save({
      phone,
      role,
      status: UserStatus.ACTIVE,
      firstName: firstName || null,
      lastName: lastName || null,
      fcmToken: null,
      referralCode,
      referredByUserId: null,
      // A brand-new manager starts with every permission except payout
      // approval — an admin can deliberately narrow them (e.g. to
      // dispatch-only) or grant payouts afterward from Staff & Roles.
      // Nobody should land with zero access by default.
      permissions: role === UserRole.MANAGER ? DEFAULT_MANAGER_PERMISSIONS : [],
    });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findByIdOrThrow(id);

    const updatedUser = {
      ...user,
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.fcmToken !== undefined && { fcmToken: dto.fcmToken }),
    };

    return this.userRepository.save(updatedUser);
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    const user = await this.findByIdOrThrow(id);
    await this.userRepository.update(id, { status });
    return { ...user, status };
  }

  // Used by DriversService when a passenger applies to become a driver.
  async updateRole(id: string, role: UserRole): Promise<User> {
    const user = await this.findByIdOrThrow(id);
    await this.userRepository.update(id, { role });
    return { ...user, role };
  }

  async updateFcmToken(id: string, fcmToken: string): Promise<void> {
    await this.userRepository.update(id, { fcmToken });
  }

  async updateLanguage(id: string, language: AppLanguage): Promise<void> {
    await this.userRepository.update(id, { language });
  }

  /** Registers a side effect of blocking (see blockListeners). */
  onUserBlocked(listener: UserBlockedListener): void {
    this.blockListeners.push(listener);
  }

  async blockUser(id: string, reason?: string, actorUserId: string | null = null): Promise<User> {
    const user = await this.findByIdOrThrow(id);
    const blockReason = reason?.trim() || null;
    await this.userRepository.update(id, { status: UserStatus.BLOCKED, blockReason });

    // ⚠️ Ilgari bloklash faqat status yozardi: bloklangan haydovchi onlayn,
    // geo-to'plamda qolib, taklif olishda davom etardi. Status allaqachon
    // yozilgan — tinglovchi xatosi bloklashni bekor qilmaydi.
    const results = await Promise.allSettled(this.blockListeners.map((listener) => listener(id)));
    results.forEach((result) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Block side effect failed for user ${id}: ${(result.reason as Error)?.message ?? result.reason}`,
        );
      }
    });

    await this.recordAudit({
      actorUserId,
      action: AUDIT_ACTIONS.userBlock,
      targetType: 'user',
      targetId: id,
      note: blockReason,
      metadata: { role: user.role },
    });

    return { ...user, status: UserStatus.BLOCKED, blockReason };
  }

  async unblockUser(id: string, actorUserId: string | null = null): Promise<User> {
    const user = await this.findByIdOrThrow(id);
    await this.userRepository.update(id, { status: UserStatus.ACTIVE, blockReason: null });
    await this.recordAudit({
      actorUserId,
      action: AUDIT_ACTIONS.userUnblock,
      targetType: 'user',
      targetId: id,
      note: user.blockReason ?? null,
      metadata: { role: user.role },
    });
    return { ...user, status: UserStatus.ACTIVE, blockReason: null };
  }

  // Staff & Roles (RBAC) — replaces a manager's entire permission set. Only
  // meaningful for MANAGER accounts; harmless no-op for any other role since
  // PermissionsGuard never consults this column for them.
  async updatePermissions(
    id: string,
    permissions: Permission[],
    actorUserId: string | null = null,
  ): Promise<User> {
    const user = await this.findByIdOrThrow(id);
    await this.userRepository.update(id, { permissions });

    const before = user.permissions ?? [];
    const added = permissions.filter((p) => !before.includes(p));
    const removed = before.filter((p) => !permissions.includes(p));
    if (added.length > 0 || removed.length > 0) {
      await this.recordAudit({
        actorUserId,
        action: AUDIT_ACTIONS.staffPermissionsUpdate,
        targetType: 'user',
        targetId: id,
        metadata: { before, after: permissions, added, removed },
      });
    }
    return { ...user, permissions };
  }

  /**
   * Amal (status/ruxsat) allaqachon yozilgan — jurnal xatosi uni bekor
   * qilmaydi, faqat logga tushadi.
   */
  private async recordAudit(entry: AuditEntryInput): Promise<void> {
    if (!this.auditLog) return;
    try {
      await this.auditLog.record(entry);
    } catch (err) {
      this.logger.error(`Audit write failed (${entry.action} ${entry.targetId}): ${(err as Error).message}`);
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 20,
    role?: UserRole,
  ): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    if (page < 1 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    const [users, total] = await this.userRepository.findAndCount({
      where: role ? { role } : {},
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { users, total, page, limit };
  }
}
