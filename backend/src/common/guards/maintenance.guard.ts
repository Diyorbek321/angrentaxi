import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SettingsService } from '../../modules/settings/settings.service';
import { UserRole } from '../../database/entities/user.entity';

interface JwtPayload {
  sub: string;
  role: string;
  type: 'access' | 'refresh';
}

/**
 * Enforces the Super Admin > Global Settings "maintenance mode" switch.
 *
 * The flag was previously stored and returned but never read by anything: an
 * admin could turn maintenance on and traffic carried on exactly as before.
 *
 * While it is on, every HTTP request is refused with 503 except:
 *   - admins and managers, so staff can still reach the panel and — critically
 *     — turn the switch back off;
 *   - authentication, so those staff can log in to begin with;
 *   - payment provider callbacks, which are server-to-server and would
 *     otherwise be retried or, worse, dropped, leaving money captured by the
 *     provider but never settled in the ledger.
 *
 * The staff role is read by verifying the bearer token here rather than from
 * `request.user`. This guard is global (APP_GUARD), so it runs *before* the
 * controller-level JwtAuthGuard that populates `request.user` — relying on
 * that field meant the role was always undefined, every admin got a 503 too,
 * and maintenance mode became a one-way switch that locked the operator out
 * of the very screen needed to disable it.
 *
 * WebSocket contexts are skipped: the gateway holds long-lived connections
 * that predate the switch, and new traffic enters through the HTTP path above.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  private readonly logger = new Logger(MaintenanceGuard.name);

  /** Path fragments that stay reachable while maintenance mode is on. */
  private static readonly ALWAYS_ALLOWED = [
    '/auth/',
    '/payments/payme/callback',
    '/payments/click/callback',
    '/payments/uzcard/callback',
    '/health',
    '/api/docs',
  ];

  constructor(
    private readonly settingsService: SettingsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path ?? request.url ?? '';

    if (MaintenanceGuard.ALWAYS_ALLOWED.some((allowed) => path.includes(allowed))) {
      return true;
    }

    const { maintenanceMode } = await this.settingsService.getGlobalSettings();

    if (!maintenanceMode) {
      return true;
    }

    if (this.isStaff(request)) {
      return true;
    }

    throw new ServiceUnavailableException(
      "Xizmat vaqtincha texnik ishlar tufayli to'xtatilgan. Iltimos, keyinroq urinib ko'ring.",
    );
  }

  /**
   * Verifies the bearer token and reports whether it belongs to staff.
   *
   * A malformed or expired token is simply "not staff" — rejecting it properly
   * is JwtAuthGuard's job, and this guard must not turn an auth problem into a
   * confusing 503.
   */
  private isStaff(request: Request): boolean {
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) {
      return false;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('APP_SECRET'),
      });

      return (
        payload.type === 'access' &&
        (payload.role === UserRole.ADMIN || payload.role === UserRole.MANAGER)
      );
    } catch {
      return false;
    }
  }
}
