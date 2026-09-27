import { Global, Injectable, Logger, Module } from '@nestjs/common';

/**
 * What happened to a courier ride that carries a food or market order.
 *
 * `picked_up` is the ride's IN_PROGRESS: the courier has the bag and is on
 * the way. `cancelled` covers both "nobody took it" and a dispatcher cancel —
 * either way the vendor needs a new courier.
 */
export type DeliveryEventKind = 'accepted' | 'arrived' | 'picked_up' | 'delivered' | 'cancelled';

export interface DeliveryEvent {
  kind: DeliveryEventKind;
  /** The ride (`orders.id`) doing the delivery. */
  deliveryOrderId: string;
  foodOrderId: string | null;
  marketOrderId: string | null;
}

export type DeliveryListener = (event: DeliveryEvent) => Promise<void> | void;

/** Anything carrying the delivery link — an Order row is enough. */
interface DeliveryRide {
  id: string;
  details?: Record<string, unknown> | null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * The one-way bridge from the ride lifecycle back to the vendor order.
 *
 * Food and market already depend on orders (to create the courier ride), so
 * orders cannot import them back without a cycle. Instead the ride lifecycle
 * publishes here and food/market subscribe at startup. Before this existed a
 * delivered courier ride left the food order stuck at "ready" until the
 * restaurant clicked it through by hand, and a courier ride that found nobody
 * was cancelled with no one told.
 */
@Injectable()
export class DeliveryEventsService {
  private readonly logger = new Logger(DeliveryEventsService.name);
  private readonly listeners: DeliveryListener[] = [];

  subscribe(listener: DeliveryListener): void {
    this.listeners.push(listener);
  }

  /**
   * Publishes `kind` for `ride` if it is a delivery ride; a no-op for taxi and
   * cargo. Never throws: the ride transition has already been committed, and
   * a vendor-side failure must not turn a completed trip into a 500 for the
   * courier. Failures are logged with both ids so they can be replayed.
   */
  async publish(ride: DeliveryRide, kind: DeliveryEventKind): Promise<void> {
    const foodOrderId = stringOrNull(ride.details?.foodOrderId);
    const marketOrderId = stringOrNull(ride.details?.marketOrderId);
    if (!foodOrderId && !marketOrderId) return;

    const event: DeliveryEvent = { kind, deliveryOrderId: ride.id, foodOrderId, marketOrderId };
    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (err) {
        this.logger.error(
          `Delivery "${kind}" for ride ${ride.id} ` +
            `(food ${foodOrderId ?? '-'}, market ${marketOrderId ?? '-'}) failed: ` +
            (err as Error).message,
        );
      }
    }
  }
}

@Global()
@Module({
  providers: [DeliveryEventsService],
  exports: [DeliveryEventsService],
})
export class DeliveryEventsModule {}
