import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Rating } from '../../database/entities/rating.entity';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { SubmitRatingDto } from './dto/submit-rating.dto';
import { UserRole } from '../../database/entities/user.entity';

export interface DriverRatingStats {
  avg: number;
  count: number;
  breakdown: Record<number, number>;
}

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async submitRating(
    fromUserId: string,
    dto: SubmitRatingDto,
    fromRole: 'passenger' | 'driver',
  ): Promise<Rating> {
    const order = await this.orderRepository.findOne({ where: { id: dto.orderId } });

    if (!order) {
      throw new NotFoundException(`Order ${dto.orderId} not found`);
    }

    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException('Rating can only be submitted for completed orders');
    }

    // Verify the caller is a party to this order
    if (fromRole === 'passenger' && order.passengerId !== fromUserId) {
      throw new BadRequestException('You are not the passenger of this order');
    }

    if (fromRole === 'driver' && order.driverId !== fromUserId) {
      throw new BadRequestException('You are not the driver of this order');
    }

    if (fromRole === 'driver' && !order.driverId) {
      throw new BadRequestException('This order has no assigned driver');
    }

    // Determine the recipient
    const toUserId =
      fromRole === 'passenger'
        ? (order.driverId as string)
        : order.passengerId;

    // Check for duplicate rating (guard in addition to DB UNIQUE constraint)
    const existing = await this.ratingRepository.findOne({
      where: { orderId: dto.orderId, fromUserId },
    });

    if (existing) {
      throw new ConflictException('You have already rated this order');
    }

    const rating = this.ratingRepository.create({
      orderId: dto.orderId,
      fromUserId,
      toUserId,
      fromRole,
      score: dto.score,
      comment: dto.comment ?? null,
    });

    const saved = await this.ratingRepository.save(rating);

    // Update driver's average rating when the passenger rates a driver
    // (or when a driver is the target)
    const driverUserId = fromRole === 'passenger' ? toUserId : fromUserId;
    await this.updateDriverRating(driverUserId);

    return saved;
  }

  /**
   * Ratings on an order carry free-text comments about the two parties, so
   * they follow the same access rule as the order itself: only the order's
   * passenger, its assigned driver, or a manager/admin may read them.
   *
   * `order.driverId` references `User.id` (the `driver` relation on Order is a
   * `@ManyToOne(() => User)`), so it is compared directly to the caller's id.
   */
  async getOrderRatings(
    orderId: string,
    user: { id: string; role: UserRole },
  ): Promise<Rating[]> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const isPassenger = order.passengerId === user.id;
    const isAssignedDriver = order.driverId !== null && order.driverId === user.id;
    const isStaff = user.role === UserRole.MANAGER || user.role === UserRole.ADMIN;

    if (!isPassenger && !isAssignedDriver && !isStaff) {
      throw new ForbiddenException('You are not authorized to view ratings for this order');
    }

    return this.ratingRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  async getDriverRatingStats(driverUserId: string): Promise<DriverRatingStats> {
    const rows = await this.ratingRepository
      .createQueryBuilder('r')
      .select('r.score', 'score')
      .addSelect('COUNT(*)', 'cnt')
      .where('r.to_user_id = :driverUserId', { driverUserId })
      .groupBy('r.score')
      .getRawMany<{ score: string; cnt: string }>();

    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let weightedSum = 0;

    for (const row of rows) {
      const score = parseInt(row.score, 10);
      const cnt = parseInt(row.cnt, 10);
      breakdown[score] = cnt;
      total += cnt;
      weightedSum += score * cnt;
    }

    const avg = total > 0 ? Math.round((weightedSum / total) * 100) / 100 : 0;

    return { avg, count: total, breakdown };
  }

  private async updateDriverRating(driverUserId: string): Promise<void> {
    try {
      await this.dataSource.query(
        `UPDATE drivers
         SET rating = (
           SELECT COALESCE(AVG(score), 5.0)
           FROM ratings
           WHERE to_user_id = $1
         )
         WHERE user_id = $1`,
        [driverUserId],
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to update driver rating for user ${driverUserId}`,
        (error as Error).message,
      );
    }
  }
}
