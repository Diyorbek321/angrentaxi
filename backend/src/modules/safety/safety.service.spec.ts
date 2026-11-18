import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ACTIVE_SOS_ALERTS_LIMIT, SafetyService } from './safety.service';
import {
  SosAlert,
  SosAlertStatus,
  SosReporterRole,
} from '../../database/entities/sos-alert.entity';
import { OrdersService } from '../orders/orders.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { AuditLogService } from '../audit/audit-log.service';

describe('SafetyService', () => {
  let service: SafetyService;

  let sosAlertRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let txManager: { update: jest.Mock };
  let auditLog: { record: jest.Mock };
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
      manager: { transaction: jest.fn(async (work: (m: unknown) => Promise<unknown>) => work(txManager)) },
    };
    txManager = { update: jest.fn(async () => ({ affected: 1 })) };
    auditLog = { record: jest.fn(async () => ({ id: 'audit-1' })) };
    ordersService = { findByIdOrThrow: jest.fn() };
    realtimeGateway = { emitToManagers: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafetyService,
        { provide: getRepositoryToken(SosAlert), useValue: sosAlertRepository },
        { provide: OrdersService, useValue: ordersService },
        { provide: RealtimeGateway, useValue: realtimeGateway },
        { provide: AuditLogService, useValue: auditLog },
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
    const activeAlert = (): SosAlert =>
      ({ id: 'alert-1', orderId: 'order-1', status: SosAlertStatus.ACTIVE, resolvedAt: null }) as SosAlert;

    it("izoh va yopgan xodim saqlanadi, audit shu tranzaksiyada, panellarga sos:resolved", async () => {
      sosAlertRepository.findOne.mockResolvedValue(activeAlert());

      const result = await service.resolveSos('alert-1', 'manager-1', "  Yo'lovchi bilan gaplashildi  ");

      expect(result).toMatchObject({
        status: SosAlertStatus.RESOLVED,
        resolvedBy: 'manager-1',
        resolutionNote: "Yo'lovchi bilan gaplashildi",
      });
      expect(result.resolvedAt).toBeInstanceOf(Date);
      expect(txManager.update).toHaveBeenCalledWith(
        SosAlert,
        { id: 'alert-1', status: SosAlertStatus.ACTIVE },
        expect.objectContaining({ status: SosAlertStatus.RESOLVED, resolvedBy: 'manager-1' }),
      );
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'manager-1',
          action: 'sos.resolve',
          targetType: 'sos_alert',
          targetId: 'alert-1',
          note: "Yo'lovchi bilan gaplashildi",
          metadata: { orderId: 'order-1' },
        }),
        txManager,
      );
      expect(realtimeGateway.emitToManagers).toHaveBeenCalledWith(
        'sos:resolved',
        expect.objectContaining({ id: 'alert-1', resolvedBy: 'manager-1' }),
      );
    });

    it('allaqachon yopilgan — 409, audit yozilmaydi', async () => {
      sosAlertRepository.findOne.mockResolvedValue({ ...activeAlert(), status: SosAlertStatus.RESOLVED });
      await expect(service.resolveSos('alert-1', 'manager-1', 'izoh')).rejects.toThrow(ConflictException);
      expect(auditLog.record).not.toHaveBeenCalled();
    });

    it("poyga: boshqa dispetcher birinchi yopdi — 0 qator, 409, socket yo'q", async () => {
      sosAlertRepository.findOne.mockResolvedValue(activeAlert());
      txManager.update.mockResolvedValue({ affected: 0 });
      await expect(service.resolveSos('alert-1', 'manager-1', 'izoh')).rejects.toThrow(ConflictException);
      expect(auditLog.record).not.toHaveBeenCalled();
      expect(realtimeGateway.emitToManagers).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the alert does not exist', async () => {
      sosAlertRepository.findOne.mockResolvedValue(null);

      await expect(service.resolveSos('missing-alert', 'manager-1', 'izoh')).rejects.toThrow(NotFoundException);
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

      // `take` is the runaway guard added alongside this filter — see
      // safety.service.active-limit.spec.ts.
      expect(sosAlertRepository.find).toHaveBeenCalledWith({
        where: { status: SosAlertStatus.ACTIVE },
        order: { createdAt: 'DESC' },
        take: ACTIVE_SOS_ALERTS_LIMIT,
      });
      expect(result).toEqual(activeAlerts);
      expect(result.every((alert) => alert.status === SosAlertStatus.ACTIVE)).toBe(true);
    });
  });
});
