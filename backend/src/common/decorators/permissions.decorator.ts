import { SetMetadata } from '@nestjs/common';
import { Permission } from '../../database/entities/user.entity';

export const PERMISSIONS_KEY = 'permissions';

// Applied alongside @Roles(UserRole.MANAGER, UserRole.ADMIN) — RolesGuard
// still enforces the coarse "must be a manager or admin" check; this adds a
// finer "if you're a manager, you must specifically have this permission"
// check on top (see PermissionsGuard). ADMIN always passes regardless.
export const RequirePermissions = (...permissions: Permission[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(PERMISSIONS_KEY, permissions);
