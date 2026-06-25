import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { EskizService } from './eskiz.service';
import { User } from '../../database/entities/user.entity';
import { Order } from '../../database/entities/order.entity';
import { Driver } from '../../database/entities/driver.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly eskizService: EskizService,
  ) {}

  async notifyOrderAccepted(
    passenger: User,
    driver: Driver,
    order: Order,
  ): Promise<void> {
    const driverUser = driver.user;
    const driverName = `${driverUser?.firstName ?? ""} ${driverUser?.lastName ?? ""}`.trim() || "Driver" || 'Driver';

    if (passenger.fcmToken) {
      await this.firebaseService.sendPush(
        passenger.fcmToken,
        'Driver Found!',
        `${driverName} is on the way to pick you up`,
        {
          orderId: order.id,
          event: 'order_accepted',
          driverId: driver.id,
        },
      );
    }

    this.logger.log(`Notified passenger ${passenger.id} of driver acceptance`);
  }

  async notifyDriverArrived(passenger: User, order: Order): Promise<void> {
    if (passenger.fcmToken) {
      await this.firebaseService.sendPush(
        passenger.fcmToken,
        'Driver Arrived',
        'Your driver has arrived at the pickup location',
        {
          orderId: order.id,
          event: 'driver_arrived',
        },
      );
    }
  }

  async notifyTripCompleted(passenger: User, finalPrice: number, order: Order): Promise<void> {
    if (passenger.fcmToken) {
      await this.firebaseService.sendPush(
        passenger.fcmToken,
        'Trip Completed',
        `Your trip is complete. Total: ${finalPrice.toLocaleString()} UZS`,
        {
          orderId: order.id,
          event: 'trip_completed',
          finalPrice: finalPrice.toString(),
        },
      );
    }
  }

  async notifyNewOrderOffer(driver: User, order: Order): Promise<void> {
    if (driver.fcmToken) {
      await this.firebaseService.sendPush(
        driver.fcmToken,
        'New Order',
        `New ride request from ${order.pickupAddress || 'nearby location'}`,
        {
          orderId: order.id,
          event: 'new_order_offer',
          pickupAddress: order.pickupAddress || '',
          dropoffAddress: order.dropoffAddress || '',
          estimatedPrice: order.estimatedPrice.toString(),
        },
      );
    }
  }

  async notifyOrderCancelled(
    targetUser: User,
    order: Order,
    reason?: string,
  ): Promise<void> {
    if (targetUser.fcmToken) {
      await this.firebaseService.sendPush(
        targetUser.fcmToken,
        'Order Cancelled',
        reason ? `Order cancelled: ${reason}` : 'Order has been cancelled',
        {
          orderId: order.id,
          event: 'order_cancelled',
          reason: reason || '',
        },
      );
    }
  }

  async sendOtpSms(phone: string, code: string): Promise<void> {
    await this.eskizService.sendSms(
      phone,
      `Angren Taxi: Your verification code is ${code}. Valid for 5 minutes.`,
    );
  }
}
