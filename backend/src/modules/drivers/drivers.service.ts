import {
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
import { REDIS_CLIENT } from '../../config/redis.config';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

export interface NearbyDriver {
  driverId: string;
  userId: string;
  distanceKm: number;
  lat: number;
  lng: number;
}

const DRIVERS_ONLINE_KEY = 'drivers:online';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async createProfile(userId: string, dto: CreateDriverDto): Promise<Driver> {
    const existing = await this.driverRepository.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Driver profile already exists for this user');
    }

    return this.driverRepository.save({
      userId,
      carModel: dto.carModel ?? null,
      carNumber: dto.carNumber ?? null,
      licensePlate: dto.licensePlate ?? null,
      rating: 5.0,
      isOnline: false,
      currentLocation: null,
    });
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
    return this.driverRepository.findOne({ where: { id }, relations: ['user'] });
  }

  async findByIdOrThrow(id: string): Promise<Driver> {
    const driver = await this.findById(id);
    if (!driver) throw new NotFoundException(`Driver ${id} not found`);
    return driver;
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

  async findAll(page = 1, limit = 20): Promise<{ drivers: Driver[]; total: number; page: number; limit: number }> {
    const [drivers, total] = await this.driverRepository.findAndCount({
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { updatedAt: 'DESC' },
    });
    return { drivers, total, page, limit };
  }
}
