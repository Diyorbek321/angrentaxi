import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseService } from './firebase.service';
import { EskizService } from './eskiz.service';
import { User, UserRole } from '../../database/entities/user.entity';
import { Order } from '../../database/entities/order.entity';
import { Driver } from '../../database/entities/driver.entity';
import { NotificationLog } from '../../database/entities/notification-log.entity';
import {
  BroadcastAudience,
  PushNotificationLog,
} from '../../database/entities/push-notification-log.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly eskizService: EskizService,
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepository: Repository<NotificationLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PushNotificationLog)
    private readonly pushNotificationLogRepository: Repository<PushNotificationLog>,
  ) {}

  // Super Admin > Marketing > Push Notifications. Best-effort per user — one
  // bad/expired token must never abort the whole broadcast. Persists a
  // PushNotificationLog row regardless of how many actually succeeded, so
  // the send-history list always reflects what was attempted.
  async broadcast(
    title: string,
    body: string,
    audience: BroadcastAudience,
    performedByUserId: string,
  ): Promise<PushNotificationLog> {
    const roleFilter =
      audience === BroadcastAudience.CUSTOMERS
        ? [UserRole.PASSENGER]
        : audience === BroadcastAudience.DRIVERS
          ? [UserRole.DRIVER]
          : [UserRole.PASSENGER, UserRole.DRIVER];

    const recipients = await this.userRepository
      .createQueryBuilder('u')
      .where('u.role IN (:...roles)', { roles: roleFilter })
      .andWhere('u.fcm_token IS NOT NULL')
      .getMany();

    let sentCount = 0;
    for (const user of recipients) {
      try {
        await this.firebaseService.sendPush(user.fcmToken as string, title, body);
        sentCount += 1;
      } catch (error) {
        this.logger.warn(
          `Broadcast push failed for user ${user.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return this.pushNotificationLogRepository.save(
      this.pushNotificationLogRepository.create({
        title,
        body,
        audience,
        sentCount,
        createdByUserId: performedByUserId,
      }),
    );
  }

  async getBroadcastHistory(page: number = 1, limit: number = 20): Promise<{
    broadcasts: PushNotificationLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [broadcasts, total] = await this.pushNotificationLogRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { broadcasts, total, page, limit };
  }

  // Persists the in-app notification history row. Deliberately isolated in
  // its own try/catch so a logging bug (bad DB state, constraint violation,
  // etc.) can never take down the actual push-sending path above it — push
  // delivery is the more important side effect and must not depend on this
  // succeeding.
  private async logNotification(
    userId: string,
    title: string,
    body: string,
    event: string,
  ): Promise<void> {
    try {
      await this.notificationLogRepository.save(
        this.notificationLogRepository.create({ userId, title, body, event }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to persist notification log for user ${userId} (event=${event}): ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async notifyOrderAccepted(
    passenger: User,
    driver: Driver,
    order: Order,
  ): Promise<void> {
    const driverUser = driver.user;
    const driverName = `${driverUser?.firstName ?? ""} ${driverUser?.lastName ?? ""}`.trim() || "Driver" || 'Driver';
    const title = 'Driver Found!';
    const body = `${driverName} is on the way to pick you up`;

    if (passenger.fcmToken) {
      await this.firebaseService.sendPush(
        passenger.fcmToken,
        title,
        body,
        {
          orderId: order.id,
          event: 'order_accepted',
          driverId: driver.id,
        },
      );
    }

    await this.logNotification(passenger.id, title, body, 'order_accepted');

    this.logger.log(`Notified passenger ${passenger.id} of driver acceptance`);
  }

  async notifyDriverArrived(passenger: User, order: Order): Promise<void> {
    const title = 'Driver Arrived';
    const body = 'Your driver has arrived at the pickup location';

    if (passenger.fcmToken) {
      await this.firebaseService.sendPush(
        passenger.fcmToken,
        title,
        body,
        {
          orderId: order.id,
          event: 'driver_arrived',
        },
      );
    }

    await this.logNotification(passenger.id, title, body, 'driver_arrived');
  }

  async notifyTripCompleted(passenger: User, finalPrice: number, order: Order): Promise<void> {
    const title = 'Trip Completed';
    const body = `Your trip is complete. Total: ${finalPrice.toLocaleString()} UZS`;

    if (passenger.fcmToken) {
      await this.firebaseService.sendPush(
        passenger.fcmToken,
        title,
        body,
        {
          orderId: order.id,
          event: 'trip_completed',
          finalPrice: finalPrice.toString(),
        },
      );
    }

    await this.logNotification(passenger.id, title, body, 'trip_completed');
  }

  async notifyNewOrderOffer(driver: User, order: Order): Promise<void> {
    const title = 'New Order';
    const body = `New ride request from ${order.pickupAddress || 'nearby location'}`;

    if (driver.fcmToken) {
      await this.firebaseService.sendPush(
        driver.fcmToken,
        title,
        body,
        {
          orderId: order.id,
          event: 'new_order_offer',
          pickupAddress: order.pickupAddress || '',
          dropoffAddress: order.dropoffAddress || '',
          estimatedPrice: order.estimatedPrice.toString(),
        },
      );
    }

    await this.logNotification(driver.id, title, body, 'new_order_offer');
  }

  async notifyOrderCancelled(
    targetUser: User,
    order: Order,
    reason?: string,
  ): Promise<void> {
    const title = 'Order Cancelled';
    const body = reason ? `Order cancelled: ${reason}` : 'Order has been cancelled';

    if (targetUser.fcmToken) {
      await this.firebaseService.sendPush(
        targetUser.fcmToken,
        title,
        body,
        {
          orderId: order.id,
          event: 'order_cancelled',
          reason: reason || '',
        },
      );
    }

    await this.logNotification(targetUser.id, title, body, 'order_cancelled');
  }

  async notifySupportReply(recipient: User): Promise<void> {
    const title = 'Qo\'llab-quvvatlash xizmati';
    const body = 'Operatordan yangi xabar keldi';

    if (recipient.fcmToken) {
      await this.firebaseService.sendPush(
        recipient.fcmToken,
        title,
        body,
        {
          event: 'support_reply',
        },
      );
    }

    await this.logNotification(recipient.id, title, body, 'support_reply');
  }

  async sendOtpSms(phone: string, code: string): Promise<void> {
    await this.eskizService.sendSms(
      phone,
      `Angren Taxi: Your verification code is ${code}. Valid for 5 minutes.`,
    );
  }

  // Caller's own notification history, newest first. Flat-capped list (no
  // cursor/offset pagination yet) — plenty for the mobile in-app list.
  async listForUser(userId: string, limit = 50): Promise<NotificationLog[]> {
    return this.notificationLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // Marks a single notification read. Scoped to userId in the query itself
  // (not a separate ownership check after fetch) so another user's
  // notification is indistinguishable from a nonexistent one — both 404.
  async markRead(id: string, userId: string): Promise<NotificationLog> {
    const log = await this.notificationLogRepository.findOne({ where: { id, userId } });

    if (!log) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    log.read = true;

    return this.notificationLogRepository.save(log);
  }

  // Marks every unread notification belonging to the caller as read in one
  // query; returns how many rows were affected.
  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationLogRepository.update(
      { userId, read: false },
      { read: true },
    );

    return { updated: result.affected ?? 0 };
  }
}
