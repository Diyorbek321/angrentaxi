import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { WithdrawalStatus } from '../../database/entities/withdrawal-request.entity';

/**
 * Route-level guarantees for the withdrawal endpoints:
 *  - POST/GET wallet/withdraw(als) are DRIVER-only and always operate on
 *    @CurrentUser() (there is no id/driverId route or body param a caller
 *    could substitute another driver's id into), so a driver structurally
 *    cannot read or create withdrawal requests for anyone but themselves.
 *  - PATCH wallet/withdrawals/:id is ADMIN-only, so a driver (even one who
 *    knows another driver's withdrawal request id) is rejected by
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

  it('requestWithdrawal is DRIVER-only and always uses the authenticated caller\'s id', async () => {
    const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.requestWithdrawal);
    expect(roles).toEqual([UserRole.DRIVER]);

    await controller.requestWithdrawal(driverA, {
      amount: 1000,
      payoutDestination: 'card-1',
    });

    expect(service.requestWithdrawal).toHaveBeenCalledWith('driver-a', {
      amount: 1000,
      payoutDestination: 'card-1',
    });
  });

  it('getMyWithdrawals is DRIVER-only and always scoped to the authenticated caller\'s id', async () => {
    const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.getMyWithdrawals);
    expect(roles).toEqual([UserRole.DRIVER]);

    await controller.getMyWithdrawals(driverA);

    expect(service.getMyWithdrawals).toHaveBeenCalledWith('driver-a');
    // No parameter exists on this handler through which a caller could ask
    // for another driver's withdrawal requests.
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
