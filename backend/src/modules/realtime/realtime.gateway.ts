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
import { Interval } from '@nestjs/schedule';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriversService } from '../drivers/drivers.service';
import { User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { UsersService } from '../users/users.service';
import { SupportService } from '../support/support.service';
import { Order } from '../../database/entities/order.entity';
import { WsJwtGuard } from '../../common/guards/ws-jwt.guard';
import { resolveCorsOrigin } from '../../config/cors-origin.util';

interface AuthSocket extends Socket {
  user: User;
}

/**
 * Per-socket sliding-window rate limit.
 *
 * The global ThrottlerGuard deliberately skips non-HTTP contexts
 * (see HttpThrottlerGuard), so without this a single authenticated socket
 * could flood `driver:location` or `support:message` unbounded.
 */
const WS_RATE_LIMIT_WINDOW_MS = 10_000;
const WS_RATE_LIMIT_MAX_EVENTS = 100;

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

@UseGuards(WsJwtGuard)
@WebSocketGateway({
  namespace: '/ws',
  // Mirrors the HTTP CORS policy instead of a blanket wildcard: a wildcard
  // combined with `credentials: true` is unsafe, and non-browser clients do
  // not enforce the rejection browsers apply to that combination.
  cors: {
    origin: resolveCorsOrigin(process.env.NODE_ENV, process.env.CORS_ORIGIN),
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

  /**
   * Hozir socketi ulangan HAYDOVCHILARNING userId lari.
   *
   * `userSocketMap` da rol saqlanmaydi, yurak urishi esa faqat haydovchilarga
   * tegishli — har tikda barcha ulangan foydalanuvchini bazadan tekshirish
   * ortiqcha yuk bo'lardi.
   */
  private readonly connectedDrivers = new Set<string>();

  // socketId -> timestamps of recent inbound events (sliding window)
  private readonly rateWindows = new Map<string, number[]>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly driversService: DriversService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => SupportService))
    private readonly supportService: SupportService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Records an inbound event and throws once a socket exceeds the window
   * budget. Called at the top of every @SubscribeMessage handler.
   */
  private enforceRateLimit(client: Socket): void {
    const now = Date.now();
    const cutoff = now - WS_RATE_LIMIT_WINDOW_MS;
    const recent = (this.rateWindows.get(client.id) || []).filter((ts) => ts > cutoff);

    if (recent.length >= WS_RATE_LIMIT_MAX_EVENTS) {
      this.rateWindows.set(client.id, recent);
      throw new WsException('Rate limit exceeded');
    }

    this.rateWindows.set(client.id, [...recent, now]);
  }

  /**
   * Authorises access to an `order:<id>` room.
   *
   * The room carries live driver GPS and every trip-chat message, so it must
   * follow the same rule as `GET /orders/:id`: passenger, assigned driver, or
   * staff only. `order.driverId` references `User.id` (the `driver` relation
   * is a `@ManyToOne(() => User)`), so comparing it to the socket user's id is
   * correct. The Order repository is injected directly rather than going
   * through OrdersQueryService to avoid a module-level circular dependency.
   */
  private async assertCanJoinOrder(user: User, orderId: string): Promise<void> {
    if (user.role === UserRole.MANAGER || user.role === UserRole.ADMIN) {
      return;
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      select: { id: true, passengerId: true, driverId: true },
    });

    if (!order) {
      throw new WsException('Order not found');
    }

    const isPassenger = order.passengerId === user.id;
    const isAssignedDriver = order.driverId !== null && order.driverId === user.id;

    if (!isPassenger && !isAssignedDriver) {
      throw new WsException('You are not authorized to join this order');
    }
  }

  afterInit(_server: Server): void {
    this.logger.log('WebSocket Gateway initialized on namespace /ws');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as Record<string, string>)['token'] ||
        (client.handshake.headers['authorization'])
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

      // Blocked accounts must lose realtime access at the handshake, not when
      // their long-lived access token finally expires. WsJwtGuard re-checks
      // this on every inbound event so an account blocked mid-session is also
      // cut off immediately.
      if (user.status === UserStatus.BLOCKED) {
        this.logger.warn(`Blocked user ${user.id} rejected at WS handshake`);
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

      // Uzilish paytida geo-to'plamdan tushib qolgan haydovchi qayta ulangach
      // yana nomzod bo'ladi. `is_online` bu yerda O'ZGARMAYDI — u niyat, va
      // uni faqat haydovchining o'zi qo'yadi.
      if (user.role === UserRole.DRIVER) {
        this.connectedDrivers.add(user.id);
        try {
          const restored = await this.driversService.restorePresence(user.id);
          if (restored) {
            this.logger.log(`Driver ${user.id} mavjudligi tiklandi`);
          }
        } catch (err) {
          // Mavjudlikni tiklay olmaslik ulanishni buzmasligi kerak: haydovchi
          // baribir birinchi joylashuv paketi bilan qaytadi.
          this.logger.warn(`Mavjudlikni tiklab bo'lmadi: ${(err as Error).message}`);
        }
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

    this.rateWindows.delete(client.id);

    if (!user) return;

    // Remove from user-socket mapping
    const sockets = this.userSocketMap.get(user.id) || [];
    const updated = sockets.filter((id) => id !== client.id);
    if (updated.length === 0) {
      this.userSocketMap.delete(user.id);
      // Faqat OXIRGI socket ketganda: haydovchi ikki qurilmadan ulangan
      // bo'lsa (yoki qayta ulanish eskisi bilan ustma-ust tushsa) yurak
      // urishi to'xtamasligi kerak.
      this.connectedDrivers.delete(user.id);
    } else {
      this.userSocketMap.set(user.id, updated);
    }

    // ⚠️ Haydovchi bu yerda OFLAYN QILINMAYDI. Ilgari qilinardi va aynan shu
    // buyurtmalarning haydovchiga yetib bormasligining sababi edi: socket
    // ekran o'chgani, ilova fonga tushgani, tarmoq almashgani yoki server
    // qayta deploy bo'lgani uchun ham uziladi. Bularning hech biri
    // haydovchining ishni to'xtatgani emas, lekin `setOnlineStatus(false)`
    // uni bazada oflayn qilib, Redis geo-to'plamidan chiqarib yuborardi.
    //
    // Halqa yopiq edi: qayta ulanish holatni tiklamasdi, joylashuv paketi
    // ham qutqara olmasdi (`updateLocation` Redis'ga faqat `isOnline` rost
    // bo'lganda yozadi). Ya'ni birinchi tarmoq uzilishidan keyin haydovchi
    // tugmani QO'LDA o'chirib-yoqmaguncha ko'rinmas bo'lib qolardi — ilovasi
    // esa o'z lokal holatini ko'rsatib "onlayn" deb turardi.
    //
    // Yetib borish mumkinligini endi mavjudlik kaliti hal qiladi
    // (`DriversService` dagi `DRIVER_PRESENCE_PREFIX` izohiga qarang): u
    // o'zi eskiradi, ya'ni telefoni haqiqatan o'chgan haydovchi bir-ikki
    // daqiqada nomzodlar ro'yxatidan o'zi tushadi.
    if (user.role === UserRole.DRIVER) {
      this.logger.log(`Driver ${user.id} socket disconnected (onlayn holati saqlanadi)`);
    }

    this.logger.log(`Client ${client.id} (user ${user.id}) disconnected`);
  }

  @SubscribeMessage('driver:location')
  async handleDriverLocation(
    client: Socket,
    payload: LocationPayload,
  ): Promise<void> {
    this.enforceRateLimit(client);

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
    this.enforceRateLimit(client);

    const user = (client as AuthSocket).user;
    if (!user) {
      throw new WsException('Not authenticated');
    }

    const { orderId } = payload;
    if (!orderId) {
      throw new WsException('orderId is required');
    }

    await this.assertCanJoinOrder(user, orderId);

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
    this.enforceRateLimit(client);

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
    this.enforceRateLimit(client);

    const user = (client as AuthSocket).user;
    if (!user) {
      throw new WsException('Not authenticated');
    }

    const { threadId } = payload;
    if (!threadId) {
      throw new WsException('threadId is required');
    }

    // The thread room receives every support message, so joining it needs the
    // same ownership rule the REST reads already enforce.
    try {
      await this.supportService.assertCanAccessThread(threadId, user);
    } catch (err) {
      throw new WsException((err as Error).message);
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

  /**
   * Ulangan haydovchilarning mavjudlik kalitini uzaytiradi.
   *
   * ⚠️ Interval TTL dan sezilarli KICHIK (60s < 150s): bitta o'tkazib
   * yuborilgan tik (deploy, GC pauzasi, sekin Redis) haydovchini
   * nomzodlar ro'yxatidan tushirib yubormasligi kerak.
   */
  @Interval(60_000)
  async refreshDriverPresence(): Promise<void> {
    if (this.connectedDrivers.size === 0) return;

    try {
      await this.driversService.touchPresence([...this.connectedDrivers]);
    } catch (err) {
      this.logger.warn(`Mavjudlik yurak urishi yiqildi: ${(err as Error).message}`);
    }
  }

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
