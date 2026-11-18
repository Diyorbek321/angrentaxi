import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/address_details.dart';
import 'package:angren_taxi/shared/models/vendor_promotion.dart';
import 'package:flutter/foundation.dart';

// ============================================================================
// OVQAT VA MARKET UCHUN UMUMIY SO'ROVLAR — docs/specs/food-market-ux-v5.md.
//
// Ikki vertikal bir xil shartnomaga ega (bekor qilish, aksiyalar, buyurtma
// qo'shimchalari) — kod ikki provayderda takrorlanmasligi uchun shu yerda.
// ============================================================================

enum VendorCancelOutcome { cancelled, notAllowed, failed }

/// `POST /food|market/orders/:id/cancel` natijasi.
@immutable
class VendorCancelResult {
  const VendorCancelResult(this.outcome, {this.message, this.order});

  final VendorCancelOutcome outcome;

  /// Foydalanuvchiga ko'rsatiladigan matn (xato yoki rad sababi).
  final String? message;

  /// Server qaytargan yangilangan buyurtma JSON'i (muvaffaqiyatda).
  final Map<String, dynamic>? order;

  bool get isCancelled => outcome == VendorCancelOutcome.cancelled;
}

/// Bekor qilish so'rovi. 409 `ORDER_CANCEL_NOT_ALLOWED` alohida natija —
/// ekran tugmani o'chirib, sababini tushuntiradi.
Future<VendorCancelResult> postVendorCancel(
  ApiClient api,
  String path, {
  String? reason,
}) async {
  final trimmed = reason?.trim();
  try {
    final response = await api.post(
      path,
      data: {
        if (trimmed != null && trimmed.isNotEmpty)
          'reason': trimmed.length > 200 ? trimmed.substring(0, 200) : trimmed,
      },
    );
    final body = response.data;
    final data = body is Map ? body['data'] : null;
    return VendorCancelResult(
      VendorCancelOutcome.cancelled,
      order: data is Map<String, dynamic> ? data : null,
    );
  } catch (e) {
    final apiError = ApiError.from(e);
    if (apiError?.code == ApiErrorCode.orderCancelNotAllowed ||
        apiError?.statusCode == 409) {
      return VendorCancelResult(
        VendorCancelOutcome.notAllowed,
        message: apiError?.message ?? AppL10n.current.saCancelNotAllowedHint,
      );
    }
    debugPrint('[VendorOrder] cancel failed: $e');
    return VendorCancelResult(
      VendorCancelOutcome.failed,
      message: extractErrorMessage(e),
    );
  }
}

/// "Chegirmalar" lentasi. Xato yoki eski server (404) — bo'sh ro'yxat:
/// lenta shunchaki ko'rinmaydi, ekranning qolgan qismi ishlayveradi.
Future<List<ActivePromotion>> fetchActivePromotions(
  ApiClient api,
  String serviceType,
) async {
  try {
    final response = await api.get(
      ApiEndpoints.activePromotions,
      params: {'serviceType': serviceType},
    );
    final body = response.data;
    return ActivePromotion.parseList(body is Map ? body['data'] : null);
  } catch (e) {
    debugPrint('[Promotions] $serviceType: $e');
    return const [];
  }
}

/// Buyurtma yaratish tanasiga v5 qo'shimchalarini qo'shadi. Bo'sh qiymatlar
/// YUBORILMAYDI — eski server noma'lum maydonni rad etadi
/// (`forbidNonWhitelisted`).
Map<String, dynamic> withOrderExtras(
  Map<String, dynamic> body, {
  String? promoCode,
  AddressDetails? addressDetails,
  String? note,
}) {
  final code = promoCode?.trim();
  final trimmedNote = note?.trim();
  return {
    ...body,
    if (code != null && code.isNotEmpty) 'promoCode': code.toUpperCase(),
    if (addressDetails != null && !addressDetails.isEmpty)
      'addressDetails': addressDetails.toJson(),
    if (trimmedNote != null && trimmedNote.isNotEmpty) 'note': trimmedNote,
  };
}
