import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import { Request } from 'express';

// Runs after RolesGuard in the guard chain (@UseGuards(JwtAuthGuard,
// RolesGuard, PermissionsGuard)). RolesGuard already enforced "must be
// MANAGER or ADMIN"; this narrows further for MANAGER accounts only — ADMIN
// always has every permission implicitly and is never checked against the
// `permissions` column. A route with no @RequirePermissions() is unaffected
// (falls through), same convention as RolesGuard's empty-metadata case.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: User }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const granted = user.permissions ?? [];
    const missing = required.filter((p) => !granted.includes(p));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing permission(s): ${missing.join(', ')}. Ask an admin to grant them from Staff & Roles.`,
      );
    }

    return true;
  }
}
