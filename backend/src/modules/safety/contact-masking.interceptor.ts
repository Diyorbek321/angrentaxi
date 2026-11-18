import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { OrderStatus } from '../../database/entities/order.entity';
import {
  callWindowOpen,
  CLIENT_FEATURES_HEADER,
  clientSupportsCallRelay,
  ContactViewer,
  isStaff,
  maskResponseBody,
} from './contact-policy';

interface MaskingRequest {
  user?: ContactViewer;
  headers: Record<string, string | string[] | undefined>;
}

function viewerOf(context: ExecutionContext): { viewer: ContactViewer; legacy: boolean } | null {
  const request = context.switchToHttp().getRequest<MaskingRequest>();
  const viewer = request.user;
  if (!viewer || isStaff(viewer.role)) return null;
  return { viewer, legacy: !clientSupportsCallRelay(request.headers[CLIENT_FEATURES_HEADER]) };
}

/**
 * Taksi/yetkazish buyurtmasi javoblarida qarshi tomon telefonini yashiradi
 * (INCIDENT-POLICY §4, qoidalar — `contact-policy.ts`). Menejer/admin
 * javobi o'zgarmaydi. `OrdersController` ga ulangan.
 */
@Injectable()
export class OrderContactMaskingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const scope = viewerOf(context);
    if (!scope) return next.handle();
    return next.handle().pipe(map((body) => maskResponseBody(body, scope.viewer, scope.legacy)));
  }
}

/** Ovqat/market mijoz javobidagi `delivery.driverPhone` (kuryer raqami). */
export function maskCourierTracking(body: unknown, legacy: boolean): unknown {
  if (Array.isArray(body)) return body.map((item) => maskCourierTracking(item, legacy));
  if (!body || typeof body !== 'object') return body;
  const record = body as Record<string, unknown>;
  for (const key of ['items', 'data'] as const) {
    if (Array.isArray(record[key])) return { ...record, [key]: maskCourierTracking(record[key], legacy) };
  }
  const delivery = record.delivery as Record<string, unknown> | null | undefined;
  if (!delivery || typeof delivery !== 'object' || !('driverPhone' in delivery)) return body;
  if (legacy && callWindowOpen(delivery.status as OrderStatus)) return body;
  return { ...record, delivery: { ...delivery, driverPhone: null } };
}

/** Ovqat/market vitrina (mijoz) kontrollerlariga ulanadi. */
@Injectable()
export class CourierContactMaskingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const scope = viewerOf(context);
    if (!scope) return next.handle();
    return next.handle().pipe(map((body) => maskCourierTracking(body, scope.legacy)));
  }
}
