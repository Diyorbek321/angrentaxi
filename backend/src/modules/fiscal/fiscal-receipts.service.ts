import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FISCAL_PLATFORM_ROLE,
  FISCAL_PLATFORM_SELLER_ROLE,
  FiscalPrincipalType,
  FiscalReceipt,
  FiscalReceiptStatus,
  FiscalReceiptType,
} from '../../database/entities/fiscal-receipt.entity';
import { FoodOrder } from '../../database/entities/food-order.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { Store } from '../../database/entities/store.entity';
import { PaymentMethod, ServiceType } from '../../database/entities/order.entity';
import { checkoutDeliveryFee } from '../delivery/delivery-ride-details';
import { SettingsService } from '../settings/settings.service';
import { DeliveryEventsService } from '../delivery/delivery-events.service';
import { FISCAL_PROVIDER, FiscalProvider, FiscalReceiptPayload } from './fiscal-provider';
import { FiscalReceiptListQuery, FiscalReceiptListResult, listFiscalReceipts } from './fiscal-receipts.query';

/** Taksi/yuk/posilka safari yoki kuryer safari — komitent haydovchi. */
export interface RideReceiptInput {
  orderId: string;
  serviceType: ServiceType;
  paymentMethod: PaymentMethod;
  total: number;
  commissionAmount: number;
  principalUserId: string;
  principalPinfl: string | null;
  principalTin: string | null;
}

export interface FiscalRetrySummary {
  retried: number;
  sent: number;
  failed: number;
  skipped: number;
}

type ReceiptDraft = Pick<
  FiscalReceipt,
  | 'orderId'
  | 'serviceType'
  | 'principalType'
  | 'principalId'
  | 'principalPinfl'
  | 'principalTin'
  | 'total'
  | 'commissionAmount'
  | 'paymentMethod'
> &
  Partial<Pick<FiscalReceipt, 'platformRole' | 'receiptType' | 'originalReceiptId'>>;

const RETRYABLE: readonly FiscalReceiptStatus[] = [FiscalReceiptStatus.FAILED, FiscalReceiptStatus.PENDING];
const MAX_ERROR_LENGTH = 500;
const PG_UNIQUE_VIOLATION = '23505';

function toReceiptPaymentMethod(method: string): 'cash' | 'card' {
  return method === (PaymentMethod.CASH as string) ? 'cash' : 'card';
}

function errorMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_LENGTH);
}

/**
 * Har bir yakunlangan buyurtma uchun fiskal chek yozuvi (komissioner modeli,
 * docs/LEGAL-COMPLIANCE.md).
 *
 * ⚠️ ASOSIY KAFOLAT: `recordFor*` hech qachon `throw` qilmaydi. Chaqiruvchi —
 * allaqachon commit qilingan buyurtma yakuni; chek xatosi haydovchiga 500
 * bo'lib qaytmasligi kerak. Xato log'ga va yozuvning `last_error` iga tushadi,
 * `retry` / `retryPending` keyin qayta yuboradi.
 */
@Injectable()
export class FiscalReceiptsService implements OnModuleInit {
  private readonly logger = new Logger(FiscalReceiptsService.name);

  constructor(
    @InjectRepository(FiscalReceipt) private readonly receiptRepo: Repository<FiscalReceipt>,
    @InjectRepository(FoodOrder) private readonly foodOrderRepo: Repository<FoodOrder>,
    @InjectRepository(MarketOrder) private readonly marketOrderRepo: Repository<MarketOrder>,
    @InjectRepository(Restaurant) private readonly restaurantRepo: Repository<Restaurant>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    @Inject(FISCAL_PROVIDER) private readonly provider: FiscalProvider,
    @Optional() private readonly deliveryEvents?: DeliveryEventsService,
    // Platforma STIR'i (§15) — `principal_type = 'platform'` yozuvlari uchun.
    @Optional() private readonly settingsService?: SettingsService,
  ) {}

  /** Xato bo'lsa `null` — chek yozuvi baribir yaratiladi (OFD ulanganda to'ldiriladi). */
  private async platformTin(): Promise<string | null> {
    try {
      return (await this.settingsService?.getPlatformTin()) ?? null;
    } catch (err) {
      this.logger.warn(`Platforma STIR'ini o'qib bo'lmadi: ${errorMessage(err)}`);
      return null;
    }
  }

  /** Ovqat/market tovari uchun chek — kuryer "yetkazdim" deganda. */
  onModuleInit(): void {
    this.deliveryEvents?.subscribe(async (event) => {
      if (event.kind !== 'delivered') return;
      if (event.foodOrderId) await this.recordForVendorOrder('food', event.foodOrderId);
      if (event.marketOrderId) await this.recordForVendorOrder('market', event.marketOrderId);
    });
  }

  async recordForRide(input: RideReceiptInput): Promise<FiscalReceipt | null> {
    // 0 so'mlik sotuv cheki ma'nosiz — masalan bepul yetkazish buyurtmasining
    // kuryer safari (docs/specs/food-market-ux-v5.md §7).
    if (!(input.total > 0)) return null;
    return this.safely(input.orderId, () =>
      this.createAndSend({
        orderId: input.orderId,
        serviceType: input.serviceType,
        principalType: FiscalPrincipalType.DRIVER,
        principalId: input.principalUserId,
        principalPinfl: input.principalPinfl,
        principalTin: input.principalTin,
        total: input.total,
        commissionAmount: input.commissionAmount,
        paymentMethod: toReceiptPaymentMethod(input.paymentMethod),
      }),
    );
  }

  /**
   * Haydovchi smenasi — platformaning O'Z xizmati: komitent yo'q, platforma
   * sotuvchi (`principal_type = 'platform'`, `platform_role = 'seller'`),
   * butun summa platforma daromadi. `order_id` o'rniga smena id'si (UUID,
   * boshqa jadvallar bilan to'qnashmaydi). To'lov hamyondan — elektron.
   */
  async recordForShiftPass(input: {
    passId: string;
    driverUserId: string;
    price: number;
  }): Promise<FiscalReceipt | null> {
    return this.safely(input.passId, async () =>
      this.createAndSend({
        orderId: input.passId,
        serviceType: 'shift_pass',
        principalType: FiscalPrincipalType.PLATFORM,
        principalId: null,
        principalPinfl: null,
        principalTin: await this.platformTin(),
        total: input.price,
        commissionAmount: input.price,
        paymentMethod: 'card',
        platformRole: FISCAL_PLATFORM_SELLER_ROLE,
      }),
    );
  }

  /**
   * Smena bekor qilinib pul qaytarildi (§20) — platformaning QAYTARISH cheki:
   * `receipt_type = 'refund'`, summa musbat (qaytarim), asl smena chekiga
   * bog'langan (`original_receipt_id`; asl chek yo'q bo'lsa null — baribir
   * yoziladi, OFD ulanganda qo'lda bog'lanadi). Bir martalik.
   */
  async recordShiftPassRefund(input: {
    passId: string;
    driverUserId: string;
    refundAmount: number;
  }): Promise<FiscalReceipt | null> {
    if (!(input.refundAmount > 0)) return null;
    return this.safely(input.passId, async () => {
      const original = await this.receiptRepo.findOne({
        where: { orderId: input.passId, receiptType: FiscalReceiptType.SALE },
      });
      if (!original) {
        this.logger.warn(`Fiskal qaytarish: smena ${input.passId} uchun asl chek topilmadi`);
      }
      return this.createAndSend({
        orderId: input.passId,
        serviceType: 'shift_pass',
        principalType: FiscalPrincipalType.PLATFORM,
        principalId: null,
        principalPinfl: null,
        principalTin: original?.principalTin ?? (await this.platformTin()),
        total: input.refundAmount,
        commissionAmount: input.refundAmount,
        paymentMethod: 'card',
        platformRole: FISCAL_PLATFORM_SELLER_ROLE,
        receiptType: FiscalReceiptType.REFUND,
        originalReceiptId: original?.id ?? null,
      });
    });
  }

  /**
   * Karta to'lovi provayder orqali qaytarildi (§23) — asl SOTUV chekiga
   * bog'langan qaytarish cheki: komitent, xizmat turi, summa va komissiya asl
   * chekdan. Asl chek yo'q bo'lsa (komitent noma'lum) — yozilmaydi, ogohlantirish.
   * Bir martalik (`(order_id, receipt_type)` unikal); hech qachon `throw` qilmaydi.
   */
  async recordOrderRefund(orderId: string): Promise<FiscalReceipt | null> {
    return this.safely(orderId, async () => {
      const original = await this.receiptRepo.findOne({
        where: { orderId, receiptType: FiscalReceiptType.SALE },
      });
      if (!original) {
        this.logger.warn(`Fiskal qaytarish: buyurtma ${orderId} uchun asl chek topilmadi — yozilmadi`);
        return null;
      }
      return this.createAndSend({
        orderId,
        serviceType: original.serviceType,
        principalType: original.principalType,
        principalId: original.principalId,
        principalPinfl: original.principalPinfl,
        principalTin: original.principalTin,
        total: Number(original.total),
        commissionAmount: Number(original.commissionAmount),
        paymentMethod: original.paymentMethod,
        platformRole: original.platformRole,
        receiptType: FiscalReceiptType.REFUND,
        originalReceiptId: original.id,
      });
    });
  }

  /**
   * Sotuvchi tovari. Summa — TOVAR qismi (yetkazish haqi kuryer safarining
   * o'z chekida). Komissiya — food/market servislari daftarga yozgan bilan
   * bir xil formula: `round(totalPrice × commissionRate / 100)`.
   */
  async recordForVendorOrder(kind: 'food' | 'market', vendorOrderId: string): Promise<FiscalReceipt | null> {
    return this.safely(vendorOrderId, async () => {
      const draft = kind === 'food' ? await this.foodDraft(vendorOrderId) : await this.marketDraft(vendorOrderId);
      if (!draft) {
        this.logger.warn(`Fiskal chek: ${kind} buyurtma ${vendorOrderId} yoki sotuvchisi topilmadi`);
        return null;
      }
      return this.createAndSend(draft);
    });
  }

  async retry(id: string): Promise<FiscalReceipt> {
    const receipt = await this.receiptRepo.findOne({ where: { id } });
    if (!receipt) {
      throw new NotFoundException(`Fiskal chek ${id} topilmadi`);
    }
    if (!RETRYABLE.includes(receipt.status)) {
      throw new BadRequestException(`Faqat 'failed' yoki 'pending' chek qayta yuboriladi (hozir: ${receipt.status})`);
    }
    return this.attemptSend(receipt);
  }

  /** Muvaffaqiyatsiz va osilib qolgan cheklar — eng eskisidan, `limit` tagacha. */
  async retryPending(limit = 50): Promise<FiscalRetrySummary> {
    const queue = await this.receiptRepo.find({
      where: RETRYABLE.map((status) => ({ status })),
      order: { createdAt: 'ASC' },
      take: limit,
    });
    const summary: FiscalRetrySummary = { retried: 0, sent: 0, failed: 0, skipped: 0 };
    for (const receipt of queue) {
      const result = await this.attemptSend(receipt);
      summary.retried += 1;
      if (result.status === FiscalReceiptStatus.SENT) summary.sent += 1;
      else if (result.status === FiscalReceiptStatus.SKIPPED) summary.skipped += 1;
      else summary.failed += 1;
    }
    return summary;
  }

  list(query: FiscalReceiptListQuery): Promise<FiscalReceiptListResult> {
    return listFiscalReceipts(this.receiptRepo, query);
  }

  // ------------------------------------------------------------- ichki

  private async safely(
    orderId: string,
    work: () => Promise<FiscalReceipt | null>,
  ): Promise<FiscalReceipt | null> {
    try {
      return await work();
    } catch (err) {
      this.logger.error(`Fiskal chek yozuvi yaratilmadi (buyurtma ${orderId}): ${errorMessage(err)}`);
      return null;
    }
  }

  private async createAndSend(draft: ReceiptDraft): Promise<FiscalReceipt> {
    const receiptType = draft.receiptType ?? FiscalReceiptType.SALE;
    const existing = await this.receiptRepo.findOne({ where: { orderId: draft.orderId, receiptType } });
    if (existing) return existing;

    let created: FiscalReceipt;
    try {
      created = await this.receiptRepo.save(
        this.receiptRepo.create({
          ...draft,
          receiptType,
          originalReceiptId: draft.originalReceiptId ?? null,
          platformRole: draft.platformRole ?? FISCAL_PLATFORM_ROLE,
          status: FiscalReceiptStatus.PENDING,
          provider: this.provider.name,
          attempts: 0,
          externalId: null,
          fiscalSign: null,
          qrUrl: null,
          lastError: null,
          sentAt: null,
        }),
      );
    } catch (err) {
      // Parallel yakunlash: boshqa chaqiruv yozuvni allaqachon yaratgan.
      if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        const winner = await this.receiptRepo.findOne({ where: { orderId: draft.orderId, receiptType } });
        if (winner) return winner;
      }
      throw err;
    }
    return this.attemptSend(created);
  }

  private async attemptSend(receipt: FiscalReceipt): Promise<FiscalReceipt> {
    const attempts = receipt.attempts + 1;
    try {
      const result = await this.provider.send(await this.toPayload(receipt));
      const outcome =
        result.status === 'sent'
          ? {
              status: FiscalReceiptStatus.SENT,
              externalId: result.externalId,
              fiscalSign: result.fiscalSign,
              qrUrl: result.qrUrl,
              lastError: null,
              sentAt: new Date(),
            }
          : { status: FiscalReceiptStatus.SKIPPED, lastError: result.reason.slice(0, MAX_ERROR_LENGTH) };
      return this.receiptRepo.save({ ...receipt, ...outcome, provider: this.provider.name, attempts });
    } catch (err) {
      this.logger.warn(`Fiskal chek ${receipt.id} yuborilmadi (urinish ${attempts}): ${errorMessage(err)}`);
      return this.receiptRepo.save({
        ...receipt,
        status: FiscalReceiptStatus.FAILED,
        lastError: errorMessage(err),
        provider: this.provider.name,
        attempts,
      });
    }
  }

  private async toPayload(receipt: FiscalReceipt): Promise<FiscalReceiptPayload> {
    const original = receipt.originalReceiptId
      ? await this.receiptRepo.findOne({ where: { id: receipt.originalReceiptId } })
      : null;
    return {
      receiptId: receipt.id,
      orderId: receipt.orderId,
      serviceType: receipt.serviceType,
      principalType: receipt.principalType,
      principalPinfl: receipt.principalPinfl,
      principalTin: receipt.principalTin,
      platformRole: receipt.platformRole,
      total: receipt.total,
      commissionAmount: receipt.commissionAmount,
      paymentMethod: receipt.paymentMethod,
      receiptType: receipt.receiptType ?? FiscalReceiptType.SALE,
      originalReceiptId: receipt.originalReceiptId ?? null,
      originalExternalId: original?.externalId ?? null,
    };
  }

  private async foodDraft(id: string): Promise<ReceiptDraft | null> {
    const order = await this.foodOrderRepo.findOne({ where: { id } });
    const restaurant = order
      ? await this.restaurantRepo.findOne({ where: { id: order.restaurantId } })
      : null;
    if (!order || !restaurant) return null;
    return this.vendorDraft('food', FiscalPrincipalType.RESTAURANT, order, restaurant);
  }

  private async marketDraft(id: string): Promise<ReceiptDraft | null> {
    const order = await this.marketOrderRepo.findOne({ where: { id } });
    const store = order ? await this.storeRepo.findOne({ where: { id: order.storeId } }) : null;
    if (!order || !store) return null;
    return this.vendorDraft('market', FiscalPrincipalType.STORE, order, store);
  }

  private vendorDraft(
    serviceType: 'food' | 'market',
    principalType: FiscalPrincipalType,
    order: { id: string; totalPrice: number; items: ReadonlyArray<{ qty: number; price: number }>; paymentMethod: string },
    vendor: { id: string; tin: string | null; commissionRate: number },
  ): ReceiptDraft {
    const totalPrice = Number(order.totalPrice);
    return {
      orderId: order.id,
      serviceType,
      principalType,
      principalId: vendor.id,
      principalPinfl: null,
      principalTin: vendor.tin ?? null,
      total: totalPrice - checkoutDeliveryFee({ totalPrice, items: order.items }),
      commissionAmount: Math.round((totalPrice * Number(vendor.commissionRate)) / 100),
      paymentMethod: toReceiptPaymentMethod(order.paymentMethod),
    };
  }
}
