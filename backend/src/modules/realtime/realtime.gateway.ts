import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { forwardRef, Inject, Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DriversService } from '../drivers/drivers.service';
import { User, UserRole } from '../../database/entities/user.entity';
import { UsersService } from '../users/users.service';
import { SupportService } from '../support/support.service';

interface AuthSocket extends Socket {
  user: User;
}

interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
  type: 'access' | 'refresh';
}

interface LocationPayload {
  lat: number;
  lng: number;
  orderId?: string;
}

interface JoinOrderPayload {
  orderId: string;
}

interface SupportMessagePayload {
  threadId: string;
  body: string;
}

interface JoinSupportThreadPayload {
  threadId: string;
}

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  // Map of userId -> socketId for targeted messages
  private readonly userSocketMap = new Map<string, string[]>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly driversService: DriversService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => SupportService))
    private readonly supportService: SupportService,
  ) {}

  afterInit(_server: Server): void {
    this.logger.log('WebSocket Gateway initialized on namespace /ws');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as Record<string, string>)['token'] ||
        (client.handshake.headers['authorization'] as string | undefined)
          ?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // No 'fallback-secret' default: env validation already makes APP_SECRET
      // required, and a silent fallback would verify handshakes against a
      // publicly known key if the variable ever went missing.
      const secret = this.configService.getOrThrow<string>('APP_SECRET');
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      if (payload.type !== 'access') {
        client.disconnect();
        return;
      }

      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        client.disconnect();
        return;
      }

      (client as AuthSocket).user = user;

      // Track user-socket mapping
      const existing = this.userSocketMap.get(user.id) || [];
      this.userSocketMap.set(user.id, [...existing, client.id]);

      // Join user's personal room
      await client.join(`user:${user.id}`);

      // Dispatchers/admins also join a shared room for live board updates
      if (user.role === UserRole.MANAGER || user.role === UserRole.ADMIN) {
        await client.join('managers');
      }

      this.logger.log(`Client ${client.id} connected as user ${user.id} (${user.role})`);
    } catch (err) {
      this.logger.warn(`WS connection rejected: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const authClient = client as AuthSocket;
    const user = authClient.user;

    if (!user) return;

    // Remove from user-socket mapping
    const sockets = this.userSocketMap.get(user.id) || [];
    const updated = sockets.filter((id) => id !== client.id);
    if (updated.length === 0) {
      this.userSocketMap.delete(user.id);
    } else {
      this.userSocketMap.set(user.id, updated);
    }

    // If driver, go offline
    if (user.role === UserRole.DRIVER) {
      try {
        const driver = await this.driversService.setOnlineStatus(user.id, false);
        this.emitToManagers('driver:offline', { driverId: driver.id });
        this.logger.log(`Driver ${user.id} went offline on disconnect`);
      } catch (err) {
        this.logger.warn(`Could not set driver offline: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Client ${client.id} (user ${user.id}) disconnected`);
  }

  @SubscribeMessage('driver:location')
  async handleDriverLocation(
    client: Socket,
    payload: LocationPayload,
  ): Promise<void> {
    const authClient = client as AuthSocket;
    const user = authClient.user;

    if (!user || user.role !== UserRole.DRIVER) {
      throw new WsException('Only drivers can update location');
    }

    const { lat, lng, orderId } = payload;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new WsException('Invalid location payload');
    }

    // Update driver location in DB + Redis
    await this.driversService.updateLocation(user.id, lat, lng);

    // If there's an active order, broadcast location to order room
    if (orderId) {
      this.server.to(`order:${orderId}`).emit('driver:location', {
        lat,
        lng,
        driverId: user.id,
        timestamp: new Date().toISOString(),
      });
    }

    // Feed the dispatcher live map — keyed by driver profile id, matching
    // the shape /drivers/online returns (not the order-room payload above,
    // which is keyed by user id for the passenger-tracking use case).
    const driver = await this.driversService.findByUserId(user.id);
    if (driver) {
      this.emitToManagers('driver:location', {
        driverId: driver.id,
        location: { lat, lng },
      });
    }
  }

  @SubscribeMessage('join:order')
  async handleJoinOrder(
    client: Socket,
    payload: JoinOrderPayload,
  ): Promise<void> {
    const { orderId } = payload;
    if (!orderId) {
      throw new WsException('orderId is required');
    }

    await client.join(`order:${orderId}`);
    this.logger.log(`Client ${client.id} joined order room order:${orderId}`);
  }

  @SubscribeMessage('leave:order')
  async handleLeaveOrder(
    client: Socket,
    payload: JoinOrderPayload,
  ): Promise<void> {
    const { orderId } = payload;
    if (!orderId) return;

    await client.leave(`order:${orderId}`);
    this.logger.log(`Client ${client.id} left order room order:${orderId}`);
  }

  @SubscribeMessage('support:message')
  async handleSupportMessage(
    client: Socket,
    payload: SupportMessagePayload,
  ): Promise<void> {
    const authClient = client as AuthSocket;
    const user = authClient.user;

    if (!user) {
      throw new WsException('Not authenticated');
    }

    const { threadId, body } = payload;
    if (!threadId || !body) {
      throw new WsException('threadId and body are required');
    }

    try {
      await this.supportService.postMessage(threadId, user, body);
    } catch (err) {
      throw new WsException((err as Error).message);
    }
  }

  @SubscribeMessage('join:support:thread')
  async handleJoinSupportThread(
    client: Socket,
    payload: JoinSupportThreadPayload,
  ): Promise<void> {
    const { threadId } = payload;
    if (!threadId) {
      throw new WsException('threadId is required');
    }

    await client.join(`support:thread:${threadId}`);
  }

  @SubscribeMessage('leave:support:thread')
  async handleLeaveSupportThread(
    client: Socket,
    payload: JoinSupportThreadPayload,
  ): Promise<void> {
    const { threadId } = payload;
    if (!threadId) return;

    await client.leave(`support:thread:${threadId}`);
  }

  // Helper methods for other services to emit events

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToOrder(orderId: string, event: string, data: unknown): void {
    this.server.to(`order:${orderId}`).emit(event, data);
  }

  emitToRoom(room: string, event: string, data: unknown): void {
    this.server.to(room).emit(event, data);
  }

  emitToManagers(event: string, data: unknown): void {
    this.server.to('managers').emit(event, data);
  }
}
