import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { Rating } from '../../database/entities/rating.entity';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { UserRole } from '../../database/entities/user.entity';

/**
 * `GET /ratings/order/:orderId` had the same IDOR shape as `GET /orders/:id`:
 * any authenticated user could read the free-text rating comments left on any
 * order. Access is now limited to the order's passenger, its assigned driver,
 * and manager/admin staff.
 */
describe('RatingsService - getOrderRatings access control', () => {
  let service: RatingsService;
  let ratingRepository: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let orderRepository: { findOne: jest.Mock };

  const ratings = [{ id: 'rating-1' }] as Rating[];

  beforeEach(async () => {
    ratingRepository = {
      find: jest.fn().mockResolvedValue(ratings),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    orderRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'order-1',
        passengerId: 'passenger-1',
        driverId: 'driver-user-1',
        status: OrderStatus.COMPLETED,
      } as Order),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: getRepositoryToken(Rating), useValue: ratingRepository },
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: DataSource, useValue: { query: jest.fn() } },
      ],
    }).compile();

    service = module.get(RatingsService);
  });

  it('rejects a user who is not a party to the order', async () => {
    await expect(
      service.getOrderRatings('order-1', { id: 'stranger-1', role: UserRole.PASSENGER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ratingRepository.find).not.toHaveBeenCalled();
  });

  it('allows the passenger', async () => {
    await expect(
      service.getOrderRatings('order-1', { id: 'passenger-1', role: UserRole.PASSENGER }),
    ).resolves.toBe(ratings);
  });

  it('allows the assigned driver', async () => {
    await expect(
      service.getOrderRatings('order-1', { id: 'driver-user-1', role: UserRole.DRIVER }),
    ).resolves.toBe(ratings);
  });

  it('allows a manager', async () => {
    await expect(
      service.getOrderRatings('order-1', { id: 'manager-1', role: UserRole.MANAGER }),
    ).resolves.toBe(ratings);
  });

  it('throws NotFoundException for an unknown order', async () => {
    orderRepository.findOne.mockResolvedValue(null);

    await expect(
      service.getOrderRatings('missing', { id: 'passenger-1', role: UserRole.PASSENGER }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
