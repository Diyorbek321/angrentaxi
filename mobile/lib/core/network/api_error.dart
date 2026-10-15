import 'package:dio/dio.dart';

// ============================================================================
// SERVER XATO KONVERTI — mashina o'qiydigan `code` (docs/LEGAL-COMPLIANCE.md §21).
//
//   { success:false, statusCode, message, code?, reasons?[{code,message}],
//     details?{…}, timestamp, path }
//
// `code` / `reasons[].code` — tilsiz, o'zgarmas kontrakt: ilova SHULARGA
// tayanadi. `message` va `reasons[].message` `Accept-Language` bo'yicha
// tarjima qilingan (ApiClient sarlavhani har so'rovda qo'yadi) — faqat
// ko'rsatish uchun. Eski server `code` bermaydi: u holda [ApiError.code]
// `null` va chaqiruvchi matn prefiksi zaxirasiga o'tadi.
// ============================================================================

/// Backend `common/errors/coded-error.ts` dagi kodlar.
abstract final class ApiErrorCode {
  static const legalNotEligible = 'LEGAL_NOT_ELIGIBLE';
  static const walletNegativeBalance = 'WALLET_NEGATIVE_BALANCE';
  static const walletInsufficientForVendor = 'WALLET_INSUFFICIENT_FOR_VENDOR';
  static const shiftPassDisabled = 'SHIFT_PASS_DISABLED';
  static const shiftPassActive = 'SHIFT_PASS_ACTIVE';
  static const shiftPassInsufficientBalance = 'SHIFT_PASS_INSUFFICIENT_BALANCE';
  static const walletTopupDisabled = 'WALLET_TOPUP_DISABLED';
  static const walletTopupAmountOutOfRange = 'WALLET_TOPUP_AMOUNT_OUT_OF_RANGE';
  static const walletTopupProviderUnavailable =
      'WALLET_TOPUP_PROVIDER_UNAVAILABLE';
  static const walletTopupProviderError = 'WALLET_TOPUP_PROVIDER_ERROR';

  /// 409 — 3 ta ochiq to'ldirish bor; `details: { maxPending }`.
  static const walletTopupTooManyPending = 'WALLET_TOPUP_TOO_MANY_PENDING';

  /// 400 — yangi karta to'ldirishi ushlab turilgan;
  /// `details: { available, held, holdDays }`.
  static const walletWithdrawalOnHold = 'WALLET_WITHDRAWAL_ON_HOLD';

  /// 403 — hujjat tasdiqlangan, PINFL/STIR/soliq maqomi/tug'ilgan sanani
  /// haydovchi o'zi o'zgartira olmaydi.
  static const legalProfileLocked = 'LEGAL_PROFILE_LOCKED';

  /// 409 — PINFL yoki STIR boshqa haydovchida; `details: { field }`.
  static const legalProfileDuplicate = 'LEGAL_PROFILE_DUPLICATE';

  /// 403 — menejer qo'lda tuzatish chegarasi (panellar); `details: { limit }`.
  static const manualAdjustmentLimit = 'MANUAL_ADJUSTMENT_LIMIT';

  /// 409 — restoran/do'kon buyurtmani qabul qilgan, mijoz endi bekor
  /// qila olmaydi (docs/specs/food-market-ux-v5.md §1).
  static const orderCancelNotAllowed = 'ORDER_CANCEL_NOT_ALLOWED';

  /// Promokod bu xizmat turiga tegishli emas (spec v5 §2).
  static const promoNotApplicable = 'PROMO_NOT_APPLICABLE';
}

/// `reasons[]` elementi.
class ApiErrorReason {
  const ApiErrorReason({required this.code, required this.message});

  final String code;

  /// Server tilida (uz/ru); bo'sh kelsa — kod.
  final String message;

  static ApiErrorReason? tryParse(dynamic json) {
    if (json is! Map) return null;
    final code = json['code']?.toString().trim() ?? '';
    final message = json['message']?.toString().trim() ?? '';
    if (code.isEmpty && message.isEmpty) return null;
    return ApiErrorReason(
        code: code, message: message.isEmpty ? code : message);
  }
}

/// Server xato javobining tahlil qilingan ko'rinishi.
class ApiError {
  const ApiError({
    this.statusCode,
    this.code,
    this.message,
    this.reasons = const [],
    this.details = const {},
  });

  final int? statusCode;

  /// Mashina kodi; eski server yoki kodsiz xatoda `null`.
  final String? code;

  /// Xom `message` (massiv bo'lsa `; ` bilan birlashtirilgan).
  final String? message;
  final List<ApiErrorReason> reasons;
  final Map<String, dynamic> details;

  bool get hasCode => code != null;

  /// `details` dagi summa (so'mda, son). Yo'q yoki son emas — `null`.
  double? amount(String key) {
    final value = details[key];
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  /// `details` dagi satr (masalan `field`). Yo'q yoki bo'sh — `null`.
  String? detailText(String key) {
    final value = details[key];
    if (value == null) return null;
    final text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  /// Javob tanasidan (Map). Konvert bo'lmasa `null`.
  static ApiError? fromBody(dynamic body, {int? statusCode}) {
    if (body is! Map) return null;
    final rawCode = body['code'];
    final code =
        rawCode is String && rawCode.trim().isNotEmpty ? rawCode.trim() : null;
    final rawReasons = body['reasons'];
    final rawDetails = body['details'];
    final status = body['statusCode'];
    return ApiError(
      statusCode: statusCode ?? (status is num ? status.toInt() : null),
      code: code,
      message: _messageOf(body['message']),
      reasons: rawReasons is List
          ? rawReasons
              .map(ApiErrorReason.tryParse)
              .whereType<ApiErrorReason>()
              .toList(growable: false)
          : const [],
      details:
          rawDetails is Map ? Map<String, dynamic>.from(rawDetails) : const {},
    );
  }

  /// Istalgan xatodan (odatda [DioException]). Server javobi bo'lmasa `null`.
  static ApiError? from(Object? error) {
    if (error is! DioException) return null;
    final response = error.response;
    if (response == null) return null;
    return fromBody(response.data, statusCode: response.statusCode);
  }

  static String? _messageOf(dynamic value) {
    if (value is String) return value;
    if (value is List) return value.map((e) => e.toString()).join('; ');
    return null;
  }
}
