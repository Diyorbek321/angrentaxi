import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ALL_PERMISSIONS, Permission, User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { generateUniqueReferralCode } from '../../common/utils/referral-code.util';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { FavoriteAddress } from '../../database/entities/favorite-address.entity';
import { Driver } from '../../database/entities/driver.entity';

// Marker stored in blockReason for self-deleted accounts, so admin tooling
// can tell them apart from accounts an admin blocked.
export const ACCOUNT_DELETED_REASON = 'account_deleted';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

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
      // A brand-new manager starts with every permission — an admin can
      // deliberately narrow them (e.g. to dispatch-only) afterward from
      // Staff & Roles. Nobody should land with zero access by default.
      permissions: role === UserRole.MANAGER ? ALL_PERMISSIONS : [],
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

  /**
   * Self-service account deletion (required by App Store guideline 5.1.1(v)).
   *
   * The user row cannot be hard-deleted: orders, trips, ratings and
   * transactions reference it and must survive for accounting. Instead every
   * piece of personal data is wiped and the phone number is released, so the
   * person can later sign up again as a brand-new account. All sessions are
   * revoked so every device is logged out immediately.
   */
  async deleteAccount(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, id, {
        phone: `deleted:${id}`,
        firstName: null,
        lastName: null,
        fcmToken: null,
        status: UserStatus.BLOCKED,
        blockReason: ACCOUNT_DELETED_REASON,
        permissions: [],
      });
      await manager.update(
        RefreshToken,
        { userId: id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      await manager.delete(FavoriteAddress, { userId: id });
      await manager.update(Driver, { userId: id }, { isOnline: false });
    });
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

  async blockUser(id: string, reason?: string): Promise<User> {
    const user = await this.findByIdOrThrow(id);
    const blockReason = reason?.trim() || null;
    await this.userRepository.update(id, { status: UserStatus.BLOCKED, blockReason });
    return { ...user, status: UserStatus.BLOCKED, blockReason };
  }

  async unblockUser(id: string): Promise<User> {
    const user = await this.findByIdOrThrow(id);
    await this.userRepository.update(id, { status: UserStatus.ACTIVE, blockReason: null });
    return { ...user, status: UserStatus.ACTIVE, blockReason: null };
  }

  // Staff & Roles (RBAC) — replaces a manager's entire permission set. Only
  // meaningful for MANAGER accounts; harmless no-op for any other role since
  // PermissionsGuard never consults this column for them.
  async updatePermissions(id: string, permissions: Permission[]): Promise<User> {
    const user = await this.findByIdOrThrow(id);
    await this.userRepository.update(id, { permissions });
    return { ...user, permissions };
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
