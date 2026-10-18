import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Mashina o'qiydigan xato kodlari (docs/LEGAL-COMPLIANCE.md §21).
 *
 * Xato konverti `{ success: false, message, statusCode, timestamp, path }`
 * o'zgarmaydi; bu kodlar QO'SHIMCHA `code` (+ ixtiyoriy `reasons`, `details`)
 * maydonlari bo'lib keladi. Ilova matnga emas, kodga tayanadi — matn
 * `Accept-Language` bo'yicha UZ/RU ga o'giriladi.
 *
 * ⚠️ Kod qiymati — kontrakt: o'zgartirmang, faqat qo'shing.
 */
export const ERROR_CODES = {
  /** Huquqiy talablar (VMQ 200) majburlanmoqda — taksiga onlayn/yoqish rad. `reasons[]` bilan. */
  legalNotEligible: 'LEGAL_NOT_ELIGIBLE',
  /** Hamyon rejimida kuryer hamyoni sotuvchiga o'tkazish uchun yetmaydi. `details: { required, balance }`. */
  walletInsufficientForVendor: 'WALLET_INSUFFICIENT_FOR_VENDOR',
  /** Daftar qoldig'i manfiy — onlayn chiqib bo'lmaydi. `details: { balance }`. */
  walletNegativeBalance: 'WALLET_NEGATIVE_BALANCE',
  /** Smena o'chiq. */
  shiftPassDisabled: 'SHIFT_PASS_DISABLED',
  /** Faol smena bor (409). */
  shiftPassActive: 'SHIFT_PASS_ACTIVE',
  /** Smena narxiga hamyon yetmaydi. `details: { price, balance }`. */
  shiftPassInsufficientBalance: 'SHIFT_PASS_INSUFFICIENT_BALANCE',
  /** Hamyonni karta orqali to'ldirish o'chiq. */
  walletTopupDisabled: 'WALLET_TOPUP_DISABLED',
  /** Summa chegaradan tashqarida. `details: { min, max }`. */
  walletTopupAmountOutOfRange: 'WALLET_TOPUP_AMOUNT_OUT_OF_RANGE',
  /** Tanlangan provayder kalitlari sozlanmagan. */
  walletTopupProviderUnavailable: 'WALLET_TOPUP_PROVIDER_UNAVAILABLE',
  /** Provayderga ulanib bo'lmadi (checkout yaratilmadi). */
  walletTopupProviderError: 'WALLET_TOPUP_PROVIDER_ERROR',
  /** Ochiq (to'lanmagan) to'ldirishlar chegarasi (409). `details: { maxPending }`. */
  walletTopupTooManyPending: 'WALLET_TOPUP_TOO_MANY_PENDING',
  /** Yechish: karta to'ldirishlari ushlab turilgan muddatda. `details: { available, held, holdDays }`. */
  walletWithdrawalOnHold: 'WALLET_WITHDRAWAL_ON_HOLD',
  /** Huquqiy hujjat tasdiqlangan — haydovchi PINFL/STIR/soliq maqomi/tug'ilgan sanani o'zi o'zgartira olmaydi (403). */
  legalProfileLocked: 'LEGAL_PROFILE_LOCKED',
  /** PINFL yoki STIR boshqa haydovchida (409). `details: { field: 'pinfl'|'tin' }`. */
  legalProfileDuplicate: 'LEGAL_PROFILE_DUPLICATE',
  /** Menejer qo'lda tuzatish chegarasidan oshdi (403). `details: { limit }`. */
  manualAdjustmentLimit: 'MANUAL_ADJUSTMENT_LIMIT',
  /** Promokod bu xizmat turiga tegishli emas (docs/specs/food-market-ux-v5.md §2). */
  promoNotApplicable: 'PROMO_NOT_APPLICABLE',
  /** Sotuvchi buyurtmani qabul qilgan — mijoz bekor qila olmaydi (409, §1). */
  orderCancelNotAllowed: 'ORDER_CANCEL_NOT_ALLOWED',
  /** Shaharlararo qatnov o'chiq (`intercityEnabled = false`) — 404. */
  intercityDisabled: 'INTERCITY_DISABLED',
  /** Yo'nalish narxlari qoidaga zid (400). `reasons[]` — har bir buzilgan qoida. */
  intercityRouteInvalid: 'INTERCITY_ROUTE_INVALID',
  /** Nuqtaning "shahar ichiga davom" sozlamasi qoidaga zid (400). `reasons[]`. */
  intercityPointInvalid: 'INTERCITY_POINT_INVALID',
  /** Haydovchi "Shaharlararo" xizmatini yoqmagan — 403. */
  intercityServiceNotEnabled: 'INTERCITY_SERVICE_NOT_ENABLED',
  /** Qatnov e'loni qoidaga zid (`reasons[]` da sabablar) — 400. */
  intercityTripInvalid: 'INTERCITY_TRIP_INVALID',
  /** Haydovchining ±3 soat ichida boshqa qatnovi bor — 409. */
  intercityTripOverlap: 'INTERCITY_TRIP_OVERLAP',
  intercityTripNotFound: 'INTERCITY_TRIP_NOT_FOUND',
  /** Qatnov bu holatda bekor qilinmaydi (yo'lga chiqqan/tugagan) — 409. */
  intercityTripNotCancellable: 'INTERCITY_TRIP_NOT_CANCELLABLE',
  /** Band so'rovi qoidaga zid (joylar soni, to'lov, olish/tushish hududi) — 400, `reasons[]`. */
  intercityBookingInvalid: 'INTERCITY_BOOKING_INVALID',
  /** Joy qolmagan / butun mashina olingan / qatnov yopilgan — 409. */
  intercitySeatsUnavailable: 'INTERCITY_SEATS_UNAVAILABLE',
  /** Yo'lovchining shu qatnovda faol bandi bor — 409. */
  intercityAlreadyBooked: 'INTERCITY_ALREADY_BOOKED',
  intercityBookingNotFound: 'INTERCITY_BOOKING_NOT_FOUND',
  /** Band bu holatda bekor qilinmaydi (yig'ish boshlangan/yakunlangan) — 409. */
  intercityBookingNotCancellable: 'INTERCITY_BOOKING_NOT_CANCELLABLE',
  /** Qatnov amali hozir mumkin emas (yig'ish/jo'nash/kelmadi) — 409, `details.reason`. */
  intercityTripActionNotAllowed: 'INTERCITY_TRIP_ACTION_NOT_ALLOWED',
  /**
   * Shaharlararo band umumiy `/orders` yo'li bilan bekor qilinmaydi/qayta
   * biriktirilmaydi — o'rindiq hisobi chetlab o'tilardi. 400; `/intercity/...` ishlating.
   */
  intercityUseIntercityEndpoint: 'INTERCITY_USE_INTERCITY_ENDPOINT',
  /**
   * Manzil haydovchi tanlagan tumanlardan tashqarida (409).
   * `details: { side: 'origin'|'destination', zones: "Yunusobod, Chilonzor" }`.
   */
  intercityOutOfZone: 'INTERCITY_OUT_OF_ZONE',
  /**
   * O'rindiq bandi mashinani shahar ichida chegaradan ko'p aylantiradi (409).
   * `details: { addedMinutes, limit }`.
   */
  intercityDetourTooLong: 'INTERCITY_DETOUR_TOO_LONG',
  /** So'rov qoidalari buzilgan (400) — sabablar `reasons[]` da (`intercity-request-policy.ts`). */
  intercityRequestInvalid: 'INTERCITY_REQUEST_INVALID',
  intercityRequestNotFound: 'INTERCITY_REQUEST_NOT_FOUND',
  /** Yo'lovchida allaqachon ochiq so'rov bor (409). `details: { requestId }`. */
  intercityRequestAlreadyOpen: 'INTERCITY_REQUEST_ALREADY_OPEN',
  /** So'rov endi ochiq emas — boshqa haydovchi oldi, bekor yoki eskirgan (409). `details: { status }`. */
  intercityRequestClosed: 'INTERCITY_REQUEST_CLOSED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ErrorReason {
  code: string;
  message: string;
}

export interface CodedErrorExtras {
  reasons?: ErrorReason[];
  details?: Record<string, string | number | boolean | null>;
}

/** Nest istisnosining tanasi — `HttpExceptionFilter` shu maydonlarni konvertga ko'chiradi. */
export interface CodedErrorBody extends CodedErrorExtras {
  message: string;
  code: ErrorCode;
}

function body(code: ErrorCode, message: string, extras: CodedErrorExtras): CodedErrorBody {
  return { message, code, ...extras };
}

export function codedBadRequest(
  code: ErrorCode,
  message: string,
  extras: CodedErrorExtras = {},
): BadRequestException {
  return new BadRequestException(body(code, message, extras));
}

export function codedConflict(
  code: ErrorCode,
  message: string,
  extras: CodedErrorExtras = {},
): ConflictException {
  return new ConflictException(body(code, message, extras));
}

export function codedForbidden(
  code: ErrorCode,
  message: string,
  extras: CodedErrorExtras = {},
): ForbiddenException {
  return new ForbiddenException(body(code, message, extras));
}

export function codedNotFound(
  code: ErrorCode,
  message: string,
  extras: CodedErrorExtras = {},
): NotFoundException {
  return new NotFoundException(body(code, message, extras));
}
