import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WalletTopupsService } from './wallet-topups.service';
import { PaymeMerchantService } from './merchant/payme-merchant.service';
import { ClickShopService } from './merchant/click-shop.service';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
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
 *  - PATCH wallet/withdrawals/:id is ADMIN, or a MANAGER explicitly granted
 *    withdrawals_approve — anyone else is rejected by RolesGuard /
 *    PermissionsGuard before the handler (and the service) ever runs. The
 *    acting staff id goes to the service for the audit log.
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
      providers: [
        { provide: PaymentsService, useValue: service },
        // Hamyonni to'ldirish yo'llari (§11) — bu spec ularni sinamaydi.
        { provide: WalletTopupsService, useValue: {} },
        { provide: PaymeMerchantService, useValue: {} },
        { provide: ClickShopService, useValue: {} },
      ],
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

  it('processWithdrawal (approve/reject/paid) needs ADMIN or MANAGER + withdrawals_approve', () => {
    const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.processWithdrawal);
    expect(roles).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
    const perms = reflector.get<Permission[]>(PERMISSIONS_KEY, controller.processWithdrawal);
    expect(perms).toEqual([Permission.WITHDRAWALS_APPROVE]);
  });

  it('processWithdrawal forwards the id, dto and acting staff id to the service', async () => {
    await controller.processWithdrawal({ id: 'fin-1' } as User, 'withdrawal-1', {
      status: WithdrawalStatus.APPROVED,
    });

    expect(service.processWithdrawal).toHaveBeenCalledWith(
      'withdrawal-1',
      { status: WithdrawalStatus.APPROVED },
      'fin-1',
    );
  });
});
