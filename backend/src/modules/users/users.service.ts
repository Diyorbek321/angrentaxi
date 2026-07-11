import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

    return this.userRepository.save({
      phone,
      role: UserRole.PASSENGER,
      status: UserStatus.ACTIVE,
      firstName: firstName || null,
      lastName: rest.join(' ') || null,
      fcmToken: null,
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
    return this.userRepository.save({
      phone,
      role,
      status: UserStatus.ACTIVE,
      firstName: firstName || null,
      lastName: lastName || null,
      fcmToken: null,
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

  async findAll(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    if (page < 1 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { users, total, page, limit };
  }
}
