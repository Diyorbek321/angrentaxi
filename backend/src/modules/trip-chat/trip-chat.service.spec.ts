import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { TripChatService } from './trip-chat.service';
import { TripMessage } from '../../database/entities/trip-message.entity';
import { Order } from '../../database/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

describe('TripChatService', () => {
  let service: TripChatService;
  let messageRepository: {
    save: jest.Mock;
    find: jest.Mock;
  };
  let ordersService: { findByIdOrThrow: jest.Mock };
  let realtimeGateway: { emitToOrder: jest.Mock };

  const orderId = 'order-1';
  const passengerId = 'passenger-1';
  const driverId = 'driver-1';
  const strangerId = 'stranger-1';

  const order = { id: orderId, passengerId, driverId } as Order;

  beforeEach(async () => {
    messageRepository = {
      save: jest.fn(),
      find: jest.fn(),
    };
    ordersService = {
      findByIdOrThrow: jest.fn().mockResolvedValue(order),
    };
    realtimeGateway = {
      emitToOrder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripChatService,
        { provide: getRepositoryToken(TripMessage), useValue: messageRepository },
        { provide: OrdersService, useValue: ordersService },
        { provide: RealtimeGateway, useValue: realtimeGateway },
      ],
    }).compile();

    service = module.get<TripChatService>(TripChatService);
  });

  describe('sendMessage', () => {
    it('sends a message as the order passenger and broadcasts it over emitToOrder', async () => {
      const saved: TripMessage = {
        id: 'msg-1',
        orderId,
        senderId: passengerId,
        senderRole: 'passenger',
        body: 'Yo\'lda qanchadasiz?',
        createdAt: new Date(),
      } as TripMessage;
      messageRepository.save.mockResolvedValue(saved);

      const result = await service.sendMessage(orderId, passengerId, saved.body);

      expect(ordersService.findByIdOrThrow).toHaveBeenCalledWith(orderId);
      expect(messageRepository.save).toHaveBeenCalledWith({
        orderId,
        senderId: passengerId,
        senderRole: 'passenger',
        body: saved.body,
      });
      expect(realtimeGateway.emitToOrder).toHaveBeenCalledWith(orderId, 'trip:message', saved);
      expect(result).toEqual(saved);
    });

    it('sends a message as the order driver, tagging it with the driver role', async () => {
      const saved: TripMessage = {
        id: 'msg-2',
        orderId,
        senderId: driverId,
        senderRole: 'driver',
        body: '2 daqiqada yetib boraman',
        createdAt: new Date(),
      } as TripMessage;
      messageRepository.save.mockResolvedValue(saved);

      await service.sendMessage(orderId, driverId, saved.body);

      expect(messageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ senderRole: 'driver' }),
      );
    });

    it('throws ForbiddenException when the sender is not the passenger or driver of the order', async () => {
      await expect(
        service.sendMessage(orderId, strangerId, 'salom'),
      ).rejects.toThrow(ForbiddenException);

      expect(messageRepository.save).not.toHaveBeenCalled();
      expect(realtimeGateway.emitToOrder).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('returns messages ordered oldest-first for a participant', async () => {
      const messages = [
        { id: 'msg-1', orderId, createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: 'msg-2', orderId, createdAt: new Date('2026-01-01T00:01:00Z') },
      ] as TripMessage[];
      messageRepository.find.mockResolvedValue(messages);

      const result = await service.getHistory(orderId, passengerId);

      expect(ordersService.findByIdOrThrow).toHaveBeenCalledWith(orderId);
      expect(messageRepository.find).toHaveBeenCalledWith({
        where: { orderId },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(messages);
    });

    it('throws ForbiddenException when the requester is not a participant of the order', async () => {
      await expect(service.getHistory(orderId, strangerId)).rejects.toThrow(
        ForbiddenException,
      );

      expect(messageRepository.find).not.toHaveBeenCalled();
    });
  });
});
