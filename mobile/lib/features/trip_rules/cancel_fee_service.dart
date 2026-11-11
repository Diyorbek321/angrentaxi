import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';

/// Bekor qilish narxi (docs/INCIDENT-POLICY.md §5): qabuldan 2 daqiqa
/// ichida va haydovchi yetib kelmagan bo'lsa — bepul, keyin jarima
/// (to'liq haydovchiga). Server hisoblaydi, ilova tasdiqlashdan OLDIN
/// ko'rsatadi va bekor qilishda `expectedFee` qilib qaytaradi.
class CancelFeeQuote {
  const CancelFeeQuote({required this.fee, this.freeUntil});

  /// So'm; 0 — bepul.
  final int fee;

  /// Bepul oyna qachon tugaydi (faqat hali bepul bo'lsa).
  final DateTime? freeUntil;

  bool get isFree => fee <= 0;

  factory CancelFeeQuote.fromJson(Map<String, dynamic> json) {
    final raw = json['fee'];
    final fee = raw is num ? raw.round() : int.tryParse('$raw') ?? 0;
    final until = json['freeUntil'];
    return CancelFeeQuote(
      fee: fee < 0 ? 0 : fee,
      freeUntil: until is String ? DateTime.tryParse(until)?.toLocal() : null,
    );
  }
}

class CancelFeeService {
  CancelFeeService(this._api);

  final ApiClient _api;

  /// Xato bo'lsa (tarmoq, eski server) — `null`: ilova odatdagi matnni
  /// ko'rsatadi, server esa jarima bo'lsa 409 bilan qayta tasdiq so'raydi.
  Future<CancelFeeQuote?> quote(String orderId) async {
    try {
      final response = await _api.get(ApiEndpoints.cancelFee(orderId));
      final body = response.data;
      if (body is! Map || body['data'] is! Map) return null;
      return CancelFeeQuote.fromJson(Map<String, dynamic>.from(body['data'] as Map));
    } catch (_) {
      return null;
    }
  }
}
