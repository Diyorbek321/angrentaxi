import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SafetyService } from './safety.service';
import {
  SosAlert,
  SosAlertStatus,
  SosReporterRole,
} from '../../database/entities/sos-alert.entity';
import { OrdersService } from '../orders/orders.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Order, OrderStatus } from '../../database/entities/order.entity';

describe('SafetyService', () => {
  let service: SafetyService;

  let sosAlertRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let ordersService: { findByIdOrThrow: jest.Mock };
  let realtimeGateway: { emitToManagers: jest.Mock };

  const baseOrder = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'order-1',
      passengerId: 'passenger-1',
      driverId: 'driver-1',
      status: OrderStatus.IN_PROGRESS,
      ...overrides,
    }) as Order;

  const reportDto = { lat: 41.0167, lng: 70.1436 };

  beforeEach(async () => {
    sosAlertRepository = {
      create: jest.fn((data) => ({ id: 'alert-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    ordersService = { findByIdOrThrow: jest.fn() };
    realtimeGateway = { emitToManagers: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafetyService,
        { provide: getRepositoryToken(SosAlert), useValue: sosAlertRepository },
        { provide: OrdersService, useValue: ordersService },
        { provide: RealtimeGateway, useValue: realtimeGateway },
      ],
    }).compile();

    service = module.get<SafetyService>(SafetyService);
  });

  describe('reportSos', () => {
    it('persists the alert and notifies managers when the reporter is the order passenger', async () => {
      ordersService.findByIdOrThrow.mockResolvedValue(baseOrder());

      const result = await service.reportSos(
        'order-1',
        'passenger-1',
        SosReporterRole.PASSENGER,
        reportDto,
      );

      expect(sosAlertRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-1',
          reportedByUserId: 'passenger-1',
          reportedByRole: SosReporterRole.PASSENGER,
          lat: reportDto.lat,
          lng: reportDto.lng,
          status: SosAlertStatus.ACTIVE,
        }),
      );
      expect(sosAlertRepository.save).toHaveBeenCalled();
      expect(realtimeGateway.emitToManagers).toHaveBeenCalledWith(
        'sos:alert',
        expect.objectContaining({
          orderId: 'order-1',
          reporterRole: SosReporterRole.PASSENGER,
        }),
      );
      expect(result.id).toBe('alert-1');
    });

    it('persists the alert and notifies managers when the reporter is the order driver', async () => {
      ordersService.findByIdOrThrow.mockResolvedValue(baseOrder());

      await service.reportSos('order-1', 'driver-1', SosReporterRole.DRIVER, reportDto);

      expect(sosAlertRepository.save).toHaveBeenCalled();
      expect(realtimeGateway.emitToManagers).toHaveBeenCalledWith(
        'sos:alert',
        expect.objectContaining({ orderId: 'order-1', reporterRole: SosReporterRole.DRIVER }),
      );
    });

    it('throws ForbiddenException when the reporter is not a party to the order', async () => {
      ordersService.findByIdOrThrow.mockResolvedValue(baseOrder());

      await expect(
        service.reportSos('order-1', 'stranger-1', SosReporterRole.PASSENGER, reportDto),
      ).rejects.toThrow(ForbiddenException);

      expect(sosAlertRepository.save).not.toHaveBeenCalled();
      expect(realtimeGateway.emitToManagers).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when a driver reports on an order they are not assigned to', async () => {
      ordersService.findByIdOrThrow.mockResolvedValue(baseOrder({ driverId: 'other-driver' }));

      await expect(
        service.reportSos('order-1', 'driver-1', SosReporterRole.DRIVER, reportDto),
      ).rejects.toThrow(ForbiddenException);

      expect(sosAlertRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('resolveSos', () => {
    it('transitions status to resolved and sets resolvedAt', async () => {
      const alert = {
        id: 'alert-1',
        status: SosAlertStatus.ACTIVE,
        resolvedAt: null,
      } as SosAlert;
      sosAlertRepository.findOne.mockResolvedValue(alert);

      const result = await service.resolveSos('alert-1');

      expect(result.status).toBe(SosAlertStatus.RESOLVED);
      expect(result.resolvedAt).toBeInstanceOf(Date);
      expect(sosAlertRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SosAlertStatus.RESOLVED }),
      );
    });

    it('throws NotFoundException when the alert does not exist', async () => {
      sosAlertRepository.findOne.mockResolvedValue(null);

      await expect(service.resolveSos('missing-alert')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listActive', () => {
    it('returns only active-status alerts, newest first', async () => {
      const activeAlerts = [
        { id: 'alert-2', status: SosAlertStatus.ACTIVE },
        { id: 'alert-1', status: SosAlertStatus.ACTIVE },
      ];
      sosAlertRepository.find.mockResolvedValue(activeAlerts);

      const result = await service.listActive();

      expect(sosAlertRepository.find).toHaveBeenCalledWith({
        where: { status: SosAlertStatus.ACTIVE },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(activeAlerts);
      expect(result.every((alert) => alert.status === SosAlertStatus.ACTIVE)).toBe(true);
    });
  });
});
