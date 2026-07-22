import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { WithdrawalOwnerType, WithdrawalStatus } from '../../database/entities/withdrawal-request.entity';

/**
 * Route-level guarantees for the withdrawal endpoints:
 *  - POST/GET wallet/withdraw(als) are open to DRIVER, MARKET, and
 *    RESTAURANT and always operate on @CurrentUser() (there is no
 *    id/driverId route or body param a caller could substitute another
 *    account's id into), so a caller structurally cannot read or create
 *    withdrawal requests for anyone but themselves.
 *  - The caller's role is mapped to the withdrawal's informational
 *    ownerType tag (resolveWithdrawalOwnerType in payments.controller.ts).
 *  - PATCH wallet/withdrawals/:id is ADMIN-only, so a non-admin (even one
 *    who knows another account's withdrawal request id) is rejected by
 *    RolesGuard before the handler — and therefore before the service —
 *    ever runs.
 */
describe('PaymentsController - withdrawals', () => {
  let controller: PaymentsController;
  let service: {
    requestWithdrawal: jest.Mock;
    getMyWithdrawals: jest.Mock;
    processWithdrawal: jest.Mock;
  };
  const reflector = new Reflector();

  const driverA = { id: 'driver-a' } as User;

  beforeEach(async () => {
    service = {
      requestWithdrawal: jest.fn().mockResolvedValue({ id: 'withdrawal-1' }),
      getMyWithdrawals: jest.fn().mockResolvedValue([]),
      processWithdrawal: jest.fn().mockResolvedValue({ id: 'withdrawal-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: service }],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('requestWithdrawal is open to DRIVER/MARKET/RESTAURANT and always uses the authenticated caller\'s id', async () => {
    const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.requestWithdrawal);
    expect(roles).toEqual([UserRole.DRIVER, UserRole.MARKET, UserRole.RESTAURANT]);

    await controller.requestWithdrawal(driverA, {
      amount: 1000,
      payoutDestination: 'card-1',
    });

    expect(service.requestWithdrawal).toHaveBeenCalledWith(
      'driver-a',
      { amount: 1000, payoutDestination: 'card-1' },
      WithdrawalOwnerType.DRIVER,
    );
  });

  it('tags the withdrawal ownerType from the caller\'s role (MARKET vendor)', async () => {
    const vendor = { id: 'vendor-a', role: UserRole.MARKET } as User;

    await controller.requestWithdrawal(vendor, {
      amount: 5000,
      payoutDestination: 'card-2',
    });

    expect(service.requestWithdrawal).toHaveBeenCalledWith(
      'vendor-a',
      { amount: 5000, payoutDestination: 'card-2' },
      WithdrawalOwnerType.VENDOR,
    );
  });

  it('tags the withdrawal ownerType from the caller\'s role (RESTAURANT owner)', async () => {
    const restaurantOwner = { id: 'restaurant-a', role: UserRole.RESTAURANT } as User;

    await controller.requestWithdrawal(restaurantOwner, {
      amount: 7000,
      payoutDestination: 'card-3',
    });

    expect(service.requestWithdrawal).toHaveBeenCalledWith(
      'restaurant-a',
      { amount: 7000, payoutDestination: 'card-3' },
      WithdrawalOwnerType.RESTAURANT,
    );
  });

  it('getMyWithdrawals is open to DRIVER/MARKET/RESTAURANT and always scoped to the authenticated caller\'s id', async () => {
    const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.getMyWithdrawals);
    expect(roles).toEqual([UserRole.DRIVER, UserRole.MARKET, UserRole.RESTAURANT]);

    await controller.getMyWithdrawals(driverA);

    expect(service.getMyWithdrawals).toHaveBeenCalledWith('driver-a');
    // No parameter exists on this handler through which a caller could ask
    // for another account's withdrawal requests.
    expect(controller.getMyWithdrawals.length).toBe(1);
  });

  it('processWithdrawal (approve/reject/paid) is ADMIN-only', () => {
    const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.processWithdrawal);
    expect(roles).toEqual([UserRole.ADMIN]);
  });

  it('processWithdrawal forwards the id and dto to the service unchanged', async () => {
    await controller.processWithdrawal('withdrawal-1', {
      status: WithdrawalStatus.APPROVED,
    });

    expect(service.processWithdrawal).toHaveBeenCalledWith('withdrawal-1', {
      status: WithdrawalStatus.APPROVED,
    });
  });
});
