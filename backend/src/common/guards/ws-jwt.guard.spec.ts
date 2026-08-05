import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { WsJwtGuard } from './ws-jwt.guard';
import { UsersService } from '../../modules/users/users.service';
import { User, UserStatus } from '../../database/entities/user.entity';

/**
 * The WS guard verified the JWT signature but never checked the token type,
 * so a refresh token (signed with the same secret) authenticated a socket. It
 * also ignored the user's BLOCKED status. Both now match what
 * RealtimeGateway.handleConnection enforces on the handshake.
 */
describe('WsJwtGuard', () => {
  let guard: WsJwtGuard;
  let jwtService: { verify: jest.Mock };
  let usersService: { findById: jest.Mock };
  let client: { handshake: { auth: Record<string, string>; headers: Record<string, string> } };

  const context = (): ExecutionContext =>
    ({
      switchToWs: () => ({ getClient: () => client }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    usersService = { findById: jest.fn() };
    client = { handshake: { auth: { token: 'token' }, headers: {} } };
    guard = new WsJwtGuard(
      jwtService as unknown as JwtService,
      usersService as unknown as UsersService,
    );
    jest.spyOn(guard['logger'], 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a refresh token', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', type: 'refresh' });

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(WsException);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('rejects a blocked user', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', type: 'access' });
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      status: UserStatus.BLOCKED,
    } as User);

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(WsException);
  });

  it('accepts an active user with an access token', async () => {
    const user = { id: 'user-1', status: UserStatus.ACTIVE } as User;
    jwtService.verify.mockReturnValue({ sub: 'user-1', type: 'access' });
    usersService.findById.mockResolvedValue(user);

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect((client as unknown as { user: User }).user).toBe(user);
  });

  it('rejects a connection without a token', async () => {
    client.handshake.auth = {};

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(WsException);
  });
});
