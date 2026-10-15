import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';

// ============================================================================
// SERVER XATOLARINI TANIB OLISH.
//
// Asosiy yo'l — xato konvertidagi mashina kodi (`code`, `reasons[]`,
// `details` — docs/LEGAL-COMPLIANCE.md §21, [ApiError]). Kod tilsiz va
// o'zgarmas, shuning uchun ruscha javobda ham ishlaydi.
//
// ZAXIRA — faqat `code` bermaydigan ESKI server uchun: o'zbekcha matn
// prefiksi bo'yicha (`driver-legal.service.ts#buildRejection`,
// `vendor-wallet-settlement.ts#insufficientWalletForVendor`). Barcha
// serverlar v4 ga o'tgach zaxirani olib tashlash mumkin.
// ============================================================================

/// Haydovchi amali nega rad etildi — ekran mos tushuntirish ko'rsatadi.
enum DriverErrorKind {
  /// Huquqiy talablar bajarilmagan (onlayn chiqish / taksini yoqish).
  legalBlocked,

  /// Hamyon rejimida naqd ovqat/market buyurtmasi uchun mablag' yetmaydi.
  vendorWalletInsufficient,

  /// Hamyon manfiy — onlayn chiqib bo'lmaydi (yechim: to'ldirish).
  walletNegativeBalance,
}

const _legalPrefixes = <String>[
  'Taksi uchun onlayn chiqa olmaysiz',
  '«Taksi» xizmatini yoqib bo',
];

/// `message` matni — [extractErrorMessage] dan farqli o'laroq, mahalliy
/// zaxira matnisiz (tanish uchun xom matn kerak).
String? rawServerMessage(Object error) => ApiError.from(error)?.message;

bool isLegalRejectionMessage(String? message) {
  if (message == null) return false;
  final text = message.trimLeft();
  return _legalPrefixes.any(text.startsWith);
}

bool isVendorWalletInsufficientMessage(String? message) {
  if (message == null) return false;
  final lower = message.toLowerCase();
  final uz = lower.contains("hamyonda mablag'") && lower.contains("do'kon");
  final ru = lower.contains('кошел') && lower.contains('магазин');
  return uz || ru;
}

/// ZAXIRA: rad etish sabablarini matndan ajratadi (eski server) — prefiks
/// va oxirgi ko'rsatma tashlanadi, qolgani `;` bo'yicha bo'linadi.
List<String> parseLegalRejectionReasons(String? message) {
  if (!isLegalRejectionMessage(message)) return const [];
  final text = message!.trim();
  final colon = text.indexOf(':');
  if (colon < 0) return const [];
  var body = text.substring(colon + 1);
  final tail = body.indexOf('. Ilovadagi');
  if (tail >= 0) body = body.substring(0, tail);
  return body
      .split(';')
      .map((e) => e.trim())
      .map((e) => e.endsWith('.') ? e.substring(0, e.length - 1) : e)
      .where((e) => e.isNotEmpty)
      .toList(growable: false);
}

/// Kod bo'yicha turkum (matnga qaramaydi).
DriverErrorKind? driverErrorKindForCode(String? code) => switch (code) {
      ApiErrorCode.legalNotEligible => DriverErrorKind.legalBlocked,
      ApiErrorCode.walletInsufficientForVendor =>
        DriverErrorKind.vendorWalletInsufficient,
      ApiErrorCode.walletNegativeBalance =>
        DriverErrorKind.walletNegativeBalance,
      _ => null,
    };

/// Xatoni turkumga ajratadi; tanilmasa `null` (oddiy xato matni ko'rsatiladi).
DriverErrorKind? classifyDriverError(Object error) {
  final api = ApiError.from(error);
  if (api == null) return null;
  // v4 server: faqat kod. Kod bor-u, bizga tegishli emas — matnga
  // qaramaymiz (tasodifiy moslik bo'lmasin).
  if (api.hasCode) return driverErrorKindForCode(api.code);
  final status = error is DioException ? error.response?.statusCode : null;
  if (status != null && status != 400) return null;
  final message = api.message;
  if (isLegalRejectionMessage(message)) return DriverErrorKind.legalBlocked;
  if (isVendorWalletInsufficientMessage(message)) {
    return DriverErrorKind.vendorWalletInsufficient;
  }
  return null;
}

/// Huquqiy rad etish sabablari: `reasons[].message` (server tilida), eski
/// serverda — matndan ajratilgani.
List<String> legalRejectionReasons(ApiError? error) {
  if (error == null) return const [];
  if (error.code == ApiErrorCode.legalNotEligible && error.reasons.isNotEmpty) {
    return error.reasons.map((r) => r.message).toList(growable: false);
  }
  return parseLegalRejectionReasons(error.message);
}

/// `details` dagi summalar bitta qatorda ("Kerak: X, balans: Y") — server
/// matni ostida aniq raqam. Kod yoki kerakli summa yo'q bo'lsa `null`.
String? codedErrorAmountsText(ApiError? error) {
  if (error == null) return null;
  final l10n = AppL10n.current;
  String price(double v) => Formatters.formatPrice(v);
  final balance = error.amount('balance');
  switch (error.code) {
    case ApiErrorCode.walletInsufficientForVendor:
      final required = error.amount('required');
      if (required == null || balance == null) return null;
      return l10n.errNeedVsBalance(price(required), price(balance));
    case ApiErrorCode.shiftPassInsufficientBalance:
      final cost = error.amount('price');
      if (cost == null || balance == null) return null;
      return l10n.errPriceVsBalance(price(cost), price(balance));
    case ApiErrorCode.walletNegativeBalance:
      return balance == null ? null : l10n.errBalanceIs(price(balance));
    case ApiErrorCode.walletTopupAmountOutOfRange:
      final min = error.amount('min');
      final max = error.amount('max');
      if (min == null || max == null) return null;
      return l10n.wltAmountRange(price(min), price(max));
  }
  return null;
}

/// Server matni + (bo'lsa) summalar qatori — snackbar/forma xatosi uchun.
String withCodedErrorAmounts(String message, ApiError? error) {
  final amounts = codedErrorAmountsText(error);
  if (amounts == null || message.contains(amounts)) return message;
  return '$message\n$amounts';
}
