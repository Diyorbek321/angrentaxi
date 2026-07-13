import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripMessage } from '../../database/entities/trip-message.entity';
import { Order } from '../../database/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export type TripChatRole = 'passenger' | 'driver';

@Injectable()
export class TripChatService {
  constructor(
    @InjectRepository(TripMessage)
    private readonly messageRepository: Repository<TripMessage>,
    private readonly ordersService: OrdersService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  // Order participants only — throws NotFoundException (via OrdersService)
  // if the order doesn't exist, ForbiddenException if the caller is neither
  // its passenger nor its driver. Note: an order without an assigned driver
  // yet (driverId === null) can never match a caller id, so unmatched
  // orders correctly reject everyone but the passenger.
  private assertParticipant(order: Order, userId: string): TripChatRole {
    if (order.passengerId === userId) {
      return 'passenger';
    }
    if (order.driverId === userId) {
      return 'driver';
    }
    throw new ForbiddenException('You are not a participant of this trip');
  }

  async sendMessage(
    orderId: string,
    senderId: string,
    body: string,
  ): Promise<TripMessage> {
    const order = await this.ordersService.findByIdOrThrow(orderId);
    const senderRole = this.assertParticipant(order, senderId);

    const message = await this.messageRepository.save({
      orderId,
      senderId,
      senderRole,
      body,
    });

    this.realtimeGateway.emitToOrder(orderId, 'trip:message', message);

    return message;
  }

  async getHistory(orderId: string, requesterId: string): Promise<TripMessage[]> {
    const order = await this.ordersService.findByIdOrThrow(orderId);
    this.assertParticipant(order, requesterId);

    return this.messageRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }
}
