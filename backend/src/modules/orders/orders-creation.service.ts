// Order intake: fare quoting, passenger-initiated order creation (raw PostGIS
// INSERT plus promo validation and the "order created" fan-out), and the
// manager/admin manual-entry variant that resolves a passenger by phone first.
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import { TariffsService } from '../tariffs/tariffs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateDispatchOrderDto } from './dto/create-dispatch-order.dto';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { haversineDistance, haversineRouteDistance } from './orders.distance.util';
import { OrdersQueryService } from './orders-query.service';

@Injectable()
export class OrdersCreationService {
  private readonly logger = new Logger(OrdersCreationService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly tariffsService: TariffsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly usersService: UsersService,
    private readonly promoCodesService: PromoCodesService,
    private readonly queryService: OrdersQueryService,
  ) {}

  async calculatePrice(
    dto: CalculatePriceDto,
  ): Promise<{ price: number; tariffId: string; distanceKm: number; durationMin: number }> {
    const price = await this.tariffsService.calculatePriceByTariffId(
      dto.tariffId,
      dto.distanceKm,
      dto.durationMin,
    );

    return {
      price,
      tariffId: dto.tariffId,
      distanceKm: dto.distanceKm,
      durationMin: dto.durationMin,
    };
  }

  async create(passengerId: string, dto: CreateOrderDto): Promise<Order> {
    const tariff = await this.tariffsService.findById(dto.tariffId);

    if (!tariff.isActive) {
      throw new BadRequestException('Selected tariff is not available');
    }

    // Estimate distance using Haversine formula (frontend should provide actual distance).
    // For multi-stop rides, sum the Haversine legs across the full path:
    // pickup -> waypoint[0] -> ... -> waypoint[n-1] -> dropoff.
    const estimatedDistanceKm = dto.waypoints?.length
      ? haversineRouteDistance(
          [
            { lat: dto.pickupLat, lng: dto.pickupLng },
            ...dto.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
            { lat: dto.dropoffLat, lng: dto.dropoffLng },
          ],
        )
      : haversineDistance(
          dto.pickupLat,
          dto.pickupLng,
          dto.dropoffLat,
          dto.dropoffLng,
        );

    const estimatedDurationMin = Math.ceil(estimatedDistanceKm * 2.5); // rough estimate

    const estimatedPrice = this.tariffsService.calculatePrice(
      tariff,
      estimatedDistanceKm,
      estimatedDurationMin,
    );

    // Validate (but don't yet consume) a promo code — usedCount/usage row are
    // only recorded on actual trip completion (see completeTrip), so an
    // abandoned/cancelled order never burns the passenger's one-time use.
    let discountAmount = 0;
    let promoCodeId: string | null = null;
    if (dto.promoCode) {
      const promoResult = await this.promoCodesService.validate(
        dto.promoCode,
        passengerId,
        estimatedPrice,
      );
      discountAmount = promoResult.discountAmount;
      promoCodeId = promoResult.promoCodeId;
    }
    const finalEstimatedPrice = Math.max(0, estimatedPrice - discountAmount);

    // Create order with PostGIS geometry
    const savedOrder = await this.orderRepository.query(
      `INSERT INTO orders (passenger_id, tariff_id, pickup_location, dropoff_location,
        pickup_address, dropoff_address, estimated_price, status, payment_method, note,
        service_type, details, promo_code_id, discount_amount, waypoints)
       VALUES ($1, $2,
         ST_SetSRID(ST_MakePoint($3, $4), 4326),
         ST_SetSRID(ST_MakePoint($5, $6), 4326),
         $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17::jsonb)
       RETURNING id`,
      [
        passengerId,
        dto.tariffId,
        dto.pickupLng,
        dto.pickupLat,
        dto.dropoffLng,
        dto.dropoffLat,
        dto.pickupAddress ?? null,
        dto.dropoffAddress ?? null,
        finalEstimatedPrice,
        OrderStatus.CREATED,
        dto.paymentMethod ?? PaymentMethod.CASH,
        dto.note ?? null,
        dto.serviceType ?? 'taxi',
        dto.details ? JSON.stringify(dto.details) : null,
        promoCodeId,
        promoCodeId ? discountAmount : null,
        dto.waypoints?.length ? JSON.stringify(dto.waypoints) : null,
      ],
    );

    const orderId = (savedOrder as Array<{ id: string }>)[0].id;
    const order = await this.queryService.findByIdOrThrow(orderId);

    // Notify passenger order was created
    this.realtimeGateway.emitToUser(passengerId, 'order:created', {
      orderId,
      status: OrderStatus.CREATED,
    });

    // Let dispatchers see the new order on the live board immediately
    this.realtimeGateway.emitToManagers('order:created', order);

    // Start driver matching asynchronously
    // Note: matching module will be injected via forward reference to avoid circular deps
    this.logger.log(`Order ${orderId} created, starting driver search...`);

    return order;
  }

  // Manager/admin manual order entry — resolves (or creates) the passenger by
  // phone, then reuses the normal create() flow so matching kicks off the same way.
  async createForDispatch(dto: CreateDispatchOrderDto): Promise<Order> {
    const passenger = await this.usersService.findOrCreateByPhone(
      dto.passengerPhone,
      dto.passengerName,
    );

    return this.create(passenger.id, {
      tariffId: dto.tariffId,
      pickupLat: dto.pickupLat,
      pickupLng: dto.pickupLng,
      dropoffLat: dto.dropoffLat,
      dropoffLng: dto.dropoffLng,
      pickupAddress: dto.pickupAddress,
      dropoffAddress: dto.dropoffAddress,
      paymentMethod: dto.paymentMethod,
      note: dto.note,
    });
  }
}
