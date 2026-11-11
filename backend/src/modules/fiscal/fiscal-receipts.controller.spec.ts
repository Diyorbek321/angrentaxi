import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FiscalReceiptsController } from './fiscal-receipts.controller';
import { FiscalReceiptsService } from './fiscal-receipts.service';
import { FiscalReceiptQueryDto } from './dto/fiscal-receipt-query.dto';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { FiscalReceiptStatus } from '../../database/entities/fiscal-receipt.entity';

describe('FiscalReceiptsController', () => {
  let controller: FiscalReceiptsController;
  const service = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, counts: {} }),
    retry: jest.fn().mockResolvedValue({ id: 'r1', status: 'sent' }),
    retryPending: jest.fn().mockResolvedValue({ retried: 0, sent: 0, failed: 0, skipped: 0 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [FiscalReceiptsController],
      providers: [{ provide: FiscalReceiptsService, useValue: service }],
    }).compile();
    controller = module.get(FiscalReceiptsController);
  });

  it('marshrut /admin/fiscal-receipts va faqat ADMIN', () => {
    expect(Reflect.getMetadata(PATH_METADATA, FiscalReceiptsController)).toBe('admin/fiscal-receipts');
    expect(new Reflector().get(ROLES_KEY, FiscalReceiptsController)).toEqual([UserRole.ADMIN]);
  });

  it("filtrlar servisga o'tadi, sana satrlari Date bo'ladi", async () => {
    await controller.list({
      status: FiscalReceiptStatus.FAILED,
      serviceType: 'taxi',
      from: '2026-10-01T00:00:00.000Z',
      page: 2,
      limit: 10,
    });
    expect(service.list).toHaveBeenCalledWith({
      status: 'failed',
      serviceType: 'taxi',
      principalType: undefined,
      orderId: undefined,
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: undefined,
      page: 2,
      limit: 10,
    });
  });

  it("noto'g'ri holat filtri DTO'da rad etiladi", async () => {
    const dto = plainToInstance(FiscalReceiptQueryDto, { status: 'bogus' });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('bitta chekni va hammasini qayta yuborish', async () => {
    await controller.retry('11111111-1111-1111-1111-111111111111');
    expect(service.retry).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
    await controller.retryPending();
    expect(service.retryPending).toHaveBeenCalled();
  });
});
