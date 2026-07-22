import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission, User, UserRole } from '../../database/entities/user.entity';

/**
 * Coverage for the RBAC layer added on top of RolesGuard: RolesGuard still
 * enforces "must be MANAGER or ADMIN" at the route level; PermissionsGuard
 * narrows further for MANAGER accounts specifically, so an admin can
 * designate one manager as dispatch-only and another as full operations
 * without a separate account type.
 */
describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const buildContext = (user: Partial<User> | undefined): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PermissionsGuard(reflector as unknown as Reflector);
  });

  it('allows the request through when the route has no @RequirePermissions metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = buildContext({ role: UserRole.MANAGER, permissions: [] });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('always allows ADMIN, regardless of their permissions column', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.DRIVERS_FINANCE]);
    const context = buildContext({ role: UserRole.ADMIN, permissions: [] });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a MANAGER who has every required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.DISPATCH]);
    const context = buildContext({
      role: UserRole.MANAGER,
      permissions: [Permission.DISPATCH, Permission.DRIVERS_VIEW],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a MANAGER missing a required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.DRIVERS_FINANCE]);
    const context = buildContext({
      role: UserRole.MANAGER,
      permissions: [Permission.DISPATCH],
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a MANAGER with no permissions at all when any are required', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.DISPATCH]);
    const context = buildContext({ role: UserRole.MANAGER, permissions: [] });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.DISPATCH]);
    const context = buildContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
