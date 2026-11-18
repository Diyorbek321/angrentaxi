import { CanActivate, ExecutionContext, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UsersService } from '../../modules/users/users.service';
import { UserStatus } from '../../database/entities/user.entity';
import { DUAL_ROLE_LOGIN_ENV, scopeUserToToken } from '../../modules/auth/session-role';

interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
  type: 'access' | 'refresh';
  app?: string;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    // Ixtiyoriy: qo'lda yig'iladigan spec'lar uchun. Yo'q bo'lsa flag default — yoqilgan.
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const token =
      (client.handshake.auth as Record<string, string>)['token'] ||
      (client.handshake.headers['authorization'])?.split(' ')[1];

    if (!token) {
      throw new WsException('No authentication token provided');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      // Refresh tokens are signed with the same secret, so the token type must
      // be checked explicitly — same rule RealtimeGateway.handleConnection
      // applies on the initial handshake.
      if (payload.type !== 'access') {
        throw new WsException('Invalid token type');
      }

      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        throw new WsException('User not found');
      }

      // Blocked accounts must lose realtime access immediately, not when their
      // long-lived access token finally expires.
      if (user.status === UserStatus.BLOCKED) {
        throw new WsException('Account is blocked');
      }

      // HTTP bilan bir xil faol rol (`session-role.ts`): yo'lovchi ilovasidagi
      // haydovchi socket orqali ham haydovchi hodisalarini yubora olmaydi.
      (client as Socket & { user: typeof user }).user = scopeUserToToken(
        user,
        payload.app,
        this.configService?.get<unknown>(DUAL_ROLE_LOGIN_ENV),
      );
      return true;
    } catch (err) {
      this.logger.warn(`WS auth failed: ${(err as Error).message}`);
      throw new WsException('Invalid or expired token');
    }
  }
}
