import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { DriversService } from '../drivers/drivers.service';
import { OrdersQueryService } from './orders-query.service';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';

/**
 * `GET /orders?status=…` cast the raw query string straight to OrderStatus.
 * TypeORM parameterises the value, so there was never an injection — but an
 * unrecognised status matched nothing and the panel rendered "no orders",
 * which reads as an empty database rather than a mistyped filter.
 */
describe('OrdersQueryService.getAllOrders — status validation', () => {
  let service: OrdersQueryService;
  let findAndCount: jest.Mock;

  beforeEach(async () => {
    findAndCount = jest.fn().mockResolvedValue([[], 0]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersQueryService,
        {
          provide: getRepositoryToken(Order),
          useValue: { findAndCount, query: jest.fn().mockResolvedValue([]) },
        },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        { provide: DriversService, useValue: { findByUserId: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrdersQueryService>(OrdersQueryService);
  });

  it('rejects an unknown status instead of returning an empty page', async () => {
    await expect(service.getAllOrders(1, 20, 'compelted')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(findAndCount).not.toHaveBeenCalled();
  });

  it('lists the accepted values in the error message', async () => {
    await expect(service.getAllOrders(1, 20, 'bogus')).rejects.toThrow(/completed/);
  });

  it('accepts every real OrderStatus', async () => {
    for (const status of Object.values(OrderStatus)) {
      await expect(service.getAllOrders(1, 20, status)).resolves.toBeDefined();
    }
    expect(findAndCount).toHaveBeenCalledTimes(Object.values(OrderStatus).length);
  });

  it('keeps working with no filter at all', async () => {
    await expect(service.getAllOrders()).resolves.toBeDefined();

    const [options] = findAndCount.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(options.where).toEqual({});
  });
});

/**
 * The DTO is the HTTP-boundary half of the same fix. It also has to carry the
 * pagination fields, because the global ValidationPipe runs with
 * `forbidNonWhitelisted` — a `@Query()`-bound PaginationDto rejects any key it
 * does not declare, and `status` was exactly such a key.
 */
describe('ListOrdersQueryDto', () => {
  it('rejects an unknown status', async () => {
    const dto = plainToInstance(ListOrdersQueryDto, { status: 'nope' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('status');
  });

  it('accepts a valid status alongside pagination', async () => {
    const dto = plainToInstance(ListOrdersQueryDto, {
      status: OrderStatus.COMPLETED,
      page: 2,
      limit: 50,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });

  it('applies the existing pagination defaults when nothing is sent', async () => {
    const dto = plainToInstance(ListOrdersQueryDto, {});

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.status).toBeUndefined();
  });
});
