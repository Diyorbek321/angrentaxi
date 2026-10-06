import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderStatus } from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import { UserRole } from '../../database/entities/user.entity';
import { TariffsService } from '../tariffs/tariffs.service';
import { computeWaitingMinutes, waitingSettingsOf, withWaitingFare } from '../tariffs/waiting-charge';
import { TaximeterService } from '../taximeter/taximeter.service';
import { OrdersQueryService } from './orders-query.service';

export interface MeterReading {
  distanceKm: number;
  durationMin: number;
  waitingFare: number;
  /** Hozirgacha jami — yakunda shu formula bilan hisoblanadi (masofa yo'lga moslanadi). */
  fare: number;
  startedAt: string;
}

/**
 * Taksometrli safarning jonli ko'rsatkichi (haydovchi va yo'lovchi ekrani).
 *
 * Yakuniy narx bilan BIR XIL formula (`OrdersCompletionService`): tarif bo'yicha
 * masofa + vaqt, ustiga kutish. Farqi faqat masofada: bu yerda xom GPS iz
 * (arzon, har 10–15 s so'raladi), yakunda esa OSRM bilan yo'lga moslangan.
 * Shuning uchun yakuniy summa ko'rsatilgandan biroz farq qilishi mumkin.
 */
@Injectable()
export class OrdersMeterService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    private readonly queryService: OrdersQueryService,
    private readonly tariffsService: TariffsService,
    private readonly taximeterService: TaximeterService,
  ) {}

  async reading(
    orderId: string,
    user: { id: string; role: UserRole },
    now = new Date(),
  ): Promise<MeterReading> {
    // Huquq: yo'lovchi / tayinlangan haydovchi / manager — chek bilan bir xil.
    const order = await this.queryService.findByIdForUser(orderId, user);
    if (!order.isMetered) {
      throw new BadRequestException('Bu buyurtma taksometrli emas');
    }
    if (order.status !== OrderStatus.IN_PROGRESS) {
      throw new BadRequestException("Taksometr faqat safar davomida ishlaydi");
    }

    const trip = await this.tripRepository.findOne({ where: { orderId } });
    const startedAt = trip?.startTime ?? now;
    const durationMin = Math.max(0, Math.ceil((now.getTime() - startedAt.getTime()) / 60_000));
    const distanceKm = await this.taximeterService.liveDistanceKm(orderId);

    const tariff = await this.tariffsService.findById(order.tariffId);
    const { freeWaitMinutes, waitingPricePerMinute } = waitingSettingsOf(tariff);
    const waitingMinutes = computeWaitingMinutes(order.arrivedAt, trip?.startTime ?? null, freeWaitMinutes);
    const breakdown = withWaitingFare(
      this.tariffsService.calculatePriceBreakdown(tariff, distanceKm, durationMin),
      waitingMinutes,
      waitingPricePerMinute,
    );

    return {
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationMin,
      waitingFare: breakdown.waitingFare,
      fare: breakdown.total,
      startedAt: startedAt.toISOString(),
    };
  }
}
