import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Driver } from '../../database/entities/driver.entity';
import { UserStatus } from '../../database/entities/user.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { PaymentMethod } from '../../database/entities/order.entity';
import { REDIS_CLIENT } from '../../config/redis.config';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UsersService } from '../users/users.service';

export interface NearbyDriver {
  driverId: string;
  userId: string;
  distanceKm: number;
  lat: number;
  lng: number;
}

export interface OnlineDriverSummary {
  id: string;
  name: string;
  phone: string;
  carModel: string;
  carNumber: string;
  rating: number;
  status: 'online' | 'busy';
  currentOrderId: string | null;
  lastSeen: Date;
  location?: { lat: number; lng: number };
}

interface OnlineDriverRow {
  id: string;
  user_id: string;
  car_model: string | null;
  car_number: string | null;
  rating: string;
  updated_at: Date;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  current_order_id: string | null;
}

const DRIVERS_ONLINE_KEY = 'drivers:online';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly usersService: UsersService,
  ) {}

  async createProfile(userId: string, dto: CreateDriverDto): Promise<Driver> {
    const existing = await this.driverRepository.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Driver profile already exists for this user');
    }

    const driver = await this.driverRepository.save({
      userId,
      carModel: dto.carModel ?? null,
      carNumber: dto.carNumber ?? null,
      licensePlate: dto.licensePlate ?? null,
      rating: 5.0,
      isOnline: false,
      currentLocation: null,
    });

    // New drivers wait for admin approval before they can go online.
    await this.usersService.updateStatus(userId, UserStatus.PENDING);

    return driver;
  }

  async findByUserId(userId: string): Promise<Driver | null> {
    return this.driverRepository.findOne({ where: { userId } });
  }

  async findByUserIdOrThrow(userId: string): Promise<Driver> {
    const driver = await this.findByUserId(userId);
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    return driver;
  }

  async findById(id: string): Promise<Driver | null> {
    const driver = await this.driverRepository.findOne({ where: { id }, relations: ['user'] });
    if (!driver) return null;
    const [enriched] = await this.attachDisplayFields([driver]);
    return enriched;
  }

  async findByIdOrThrow(id: string): Promise<Driver> {
    const driver = await this.findById(id);
    if (!driver) throw new NotFoundException(`Driver ${id} not found`);
    return driver;
  }

  // The `user` relation only carries phone/firstName/lastName — the web panels
  // expect those flattened onto the driver plus a completed-trip count, which
  // has no dedicated column, so we compute both here rather than in every caller.
  private async attachDisplayFields(drivers: Driver[]): Promise<Driver[]> {
    if (drivers.length === 0) return drivers;

    const userIds = drivers.map((d) => d.userId);
    const rows: Array<{ driver_id: string; cnt: string }> = await this.driverRepository.query(
      `SELECT driver_id, COUNT(*)::int as cnt FROM orders
       WHERE driver_id = ANY($1) AND status = 'completed'
       GROUP BY driver_id`,
      [userIds],
    );
    const tripCountByUserId = new Map(rows.map((r) => [r.driver_id, Number(r.cnt)]));

    for (const driver of drivers) {
      const flat = driver as unknown as Record<string, unknown>;
      if (driver.user) {
        flat.firstName = driver.user.firstName;
        flat.lastName = driver.user.lastName;
        flat.phone = driver.user.phone;
        flat.status = driver.user.status;
        flat.blockReason = driver.user.blockReason;
      }
      flat.totalTrips = tripCountByUserId.get(driver.userId) ?? 0;
    }

    return drivers;
  }

  async getProfile(userId: string): Promise<Driver> {
    return this.findByUserIdOrThrow(userId);
  }

  async updateProfile(userId: string, dto: UpdateDriverDto): Promise<Driver> {
    const driver = await this.findByUserIdOrThrow(userId);

    const updated = {
      ...driver,
      ...(dto.carModel !== undefined && { carModel: dto.carModel }),
      ...(dto.carNumber !== undefined && { carNumber: dto.carNumber }),
      ...(dto.licensePlate !== undefined && { licensePlate: dto.licensePlate }),
    };

    return this.driverRepository.save(updated);
  }

  async updateLocation(userId: string, lat: number, lng: number): Promise<void> {
    const driver = await this.findByUserIdOrThrow(userId);

    // Update PostGIS geometry
    await this.driverRepository.query(
      `UPDATE drivers SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE user_id = $3`,
      [lng, lat, userId],
    );

    // Update Redis geo index if driver is online
    if (driver.isOnline) {
      await this.redis.geoadd(DRIVERS_ONLINE_KEY, lng, lat, driver.id);
    }
  }

  async setOnlineStatus(userId: string, isOnline: boolean): Promise<Driver> {
    const driver = await this.findByUserIdOrThrow(userId);

    if (isOnline && driver.user?.status === UserStatus.PENDING) {
      throw new BadRequestException(
        'Your account is awaiting admin approval before you can go online',
      );
    }

    if (isOnline && driver.balance < 0) {
      throw new BadRequestException(
        `Balansingiz manfiy (${driver.balance.toLocaleString('uz-UZ')} so'm). Onlayn bo'lish uchun hisobni to'ldiring.`,
      );
    }

    await this.driverRepository.update(driver.id, { isOnline });

    if (!isOnline) {
      await this.redis.zrem(DRIVERS_ONLINE_KEY, driver.id);
      this.logger.log(`Driver ${driver.id} went offline, removed from Redis`);
    } else {
      // Add to Redis geo if we have a location
      const updatedDriver = await this.driverRepository.findOne({
        where: { id: driver.id },
      });

      if (updatedDriver?.currentLocation) {
        const result = await this.driverRepository.query(
          `SELECT ST_X(current_location::geometry) as lng, ST_Y(current_location::geometry) as lat FROM drivers WHERE id = $1`,
          [driver.id],
        );
        if (result.length > 0) {
          const { lng, lat } = result[0] as { lng: number; lat: number };
          await this.redis.geoadd(DRIVERS_ONLINE_KEY, lng, lat, driver.id);
        }
      }
    }

    return { ...driver, isOnline };
  }

  async getNearbyDrivers(
    lat: number,
    lng: number,
    radiusKm: number = 3,
  ): Promise<NearbyDriver[]> {
    try {
      const results = await this.redis.georadius(
        DRIVERS_ONLINE_KEY,
        lng,
        lat,
        radiusKm,
        'km',
        'WITHCOORD',
        'WITHDIST',
        'ASC',
        'COUNT',
        10,
      );

      if (!results || results.length === 0) {
        return [];
      }

      const nearbyDrivers: NearbyDriver[] = [];

      for (const result of results) {
        const [driverId, distStr, coords] = result as [string, string, [string, string]];
        const driver = await this.findById(driverId);

        if (driver) {
          nearbyDrivers.push({
            driverId: driver.id,
            userId: driver.userId,
            distanceKm: parseFloat(distStr),
            lng: parseFloat(coords[0]),
            lat: parseFloat(coords[1]),
          });
        }
      }

      return nearbyDrivers;
    } catch (err) {
      this.logger.error(`Redis georadius error: ${(err as Error).message}`);
      return [];
    }
  }

  async updateRating(driverId: string, newRating: number): Promise<void> {
    await this.driverRepository.update(driverId, { rating: newRating });
  }

  async getOnlineDriversList(): Promise<OnlineDriverSummary[]> {
    const rows: OnlineDriverRow[] = await this.driverRepository.query(
      `SELECT d.id, d.user_id, d.car_model, d.car_number, d.rating, d.updated_at,
              u.first_name, u.last_name, u.phone,
              active_order.id as current_order_id
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       LEFT JOIN LATERAL (
         SELECT id FROM orders
         WHERE driver_id = d.user_id
           AND status IN ('accepted', 'arrived', 'in_progress')
         ORDER BY created_at DESC
         LIMIT 1
       ) active_order ON true
       WHERE d.is_online = true
       ORDER BY d.updated_at DESC`,
    );

    if (rows.length === 0) {
      return [];
    }

    const positions = await this.redis.geopos(
      DRIVERS_ONLINE_KEY,
      ...rows.map((row) => row.id),
    );

    return rows.map((row, index) => {
      const pos = positions[index] as [string, string] | null;
      const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Driver';

      return {
        id: row.id,
        name,
        phone: row.phone,
        carModel: row.car_model ?? '',
        carNumber: row.car_number ?? '',
        rating: parseFloat(row.rating),
        status: row.current_order_id ? 'busy' : 'online',
        currentOrderId: row.current_order_id,
        lastSeen: row.updated_at,
        location: pos ? { lat: parseFloat(pos[1]), lng: parseFloat(pos[0]) } : undefined,
      };
    });
  }

  // Pure balance mutation with no transaction record of its own — used by
  // OrdersService after it has already written the CREDIT/DEBIT pair for a
  // completed trip's payout + commission, so the ledger isn't double-counted.
  // If the delta pushes the driver negative while online, take them offline
  // immediately rather than leaving them online-but-blocked until their next
  // toggle.
  async adjustBalance(userId: string, delta: number): Promise<{ driver: Driver; wentOffline: boolean }> {
    const driver = await this.findByUserIdOrThrow(userId);
    const newBalance = driver.balance + delta;
    const wentOffline = newBalance < 0 && driver.isOnline;

    await this.driverRepository.update(driver.id, {
      balance: newBalance,
      ...(wentOffline && { isOnline: false }),
    });

    if (wentOffline) {
      await this.redis.zrem(DRIVERS_ONLINE_KEY, driver.id);
      this.logger.log(`Driver ${driver.id} balance went negative (${newBalance}), taken offline`);
    }

    return {
      driver: { ...driver, balance: newBalance, isOnline: wentOffline ? false : driver.isOnline },
      wentOffline,
    };
  }

  // Manual top-up/adjustment. `amount` may be negative for a correction. This
  // is also the endpoint a future Telegram top-up bot will call.
  async addFunds(driverId: string, amount: number, note?: string): Promise<Driver> {
    const driver = await this.findByIdOrThrow(driverId);

    await this.transactionRepository.save({
      userId: driver.userId,
      orderId: null,
      amount: Math.abs(amount),
      type: amount >= 0 ? TransactionType.CREDIT : TransactionType.DEBIT,
      paymentMethod: PaymentMethod.CASH,
      status: TransactionStatus.COMPLETED,
      externalId: note ?? null,
    });

    const newBalance = driver.balance + amount;
    await this.driverRepository.update(driver.id, { balance: newBalance });

    return this.findByIdOrThrow(driverId);
  }

  async setCommissionRate(driverId: string, commissionRate: number | null): Promise<Driver> {
    await this.findByIdOrThrow(driverId);
    await this.driverRepository.update(driverId, { commissionRate });
    return this.findByIdOrThrow(driverId);
  }

  async countAll(): Promise<number> {
    return this.driverRepository.count();
  }

  async countOnline(): Promise<number> {
    return this.driverRepository.count({ where: { isOnline: true } });
  }

  async countPending(): Promise<number> {
    return this.driverRepository
      .createQueryBuilder('d')
      .innerJoin('d.user', 'u')
      .where('u.status = :status', { status: UserStatus.PENDING })
      .getCount();
  }

  async findAll(
    page = 1,
    limit = 20,
    filters: { status?: string; isOnline?: boolean; search?: string } = {},
  ): Promise<{ drivers: Driver[]; total: number; page: number; limit: number }> {
    const qb = this.driverRepository
      .createQueryBuilder('d')
      .innerJoinAndSelect('d.user', 'u')
      .orderBy('d.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.isOnline !== undefined) {
      qb.andWhere('d.isOnline = :isOnline', { isOnline: filters.isOnline });
    }
    if (filters.status) {
      qb.andWhere('u.status = :status', { status: filters.status });
    }
    if (filters.search) {
      qb.andWhere(
        '(u.first_name ILIKE :search OR u.last_name ILIKE :search OR u.phone ILIKE :search OR d.car_number ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const [drivers, total] = await qb.getManyAndCount();
    return { drivers: await this.attachDisplayFields(drivers), total, page, limit };
  }
}
