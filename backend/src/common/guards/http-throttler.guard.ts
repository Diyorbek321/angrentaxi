import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard limited to HTTP traffic.
 *
 * Registered globally via APP_GUARD, so it is also invoked for WebSocket
 * gateway handlers (RealtimeGateway). The stock guard resolves the request and
 * response through `context.switchToHttp()`, which yields the raw socket
 * payload for a WS context — `res.header(...)` then throws and every realtime
 * event would break. Non-HTTP contexts are therefore skipped; realtime traffic
 * is already gated by WsJwtGuard.
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return context.getType() !== 'http';
  }
}
