import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DriversService } from '../drivers/drivers.service';
import { User, UserRole } from '../../database/entities/user.entity';
import { UsersService } from '../users/users.service';

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

      const secret = this.configService.get<string>('APP_SECRET', 'fallback-secret');
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
        await this.driversService.setOnlineStatus(user.id, false);
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
}
