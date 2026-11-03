import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';

/// Ilova orqali qo'ng'iroq va safar kuzatuvi havolasi
/// (docs/INCIDENT-POLICY.md §4).
///
/// Tomonlar bir-birining raqamini buyurtma javobida ko'rmaydi: qo'ng'iroq
/// tugmasi bosilganda server raqamni FAQAT faol buyurtmada beradi va har
/// so'rovni jurnalga yozadi. Raqam saqlanmaydi — darhol terish oynasiga.
class ContactRelayService {
  ContactRelayService(this._api, {String? apiBaseUrl})
      : _apiBaseUrl = apiBaseUrl ?? AppConfig.apiBaseUrl;

  final ApiClient _api;
  final String _apiBaseUrl;

  static Map<String, dynamic> _data(dynamic body) =>
      (body as Map<String, dynamic>)['data'] as Map<String, dynamic>;

  /// Qarshi tomon raqami (yo'lovchi → haydovchi, haydovchi/kuryer → mijoz).
  Future<String> counterpartyPhone(String orderId) async {
    final response = await _api.post(ApiEndpoints.orderCall(orderId));
    final phone = _data(response.data)['phone']?.toString().trim() ?? '';
    if (phone.isEmpty) throw StateError('empty phone');
    return phone;
  }

  /// Yaqinlarga yuboriladigan ommaviy sahifa havolasi.
  Future<Uri> shareLink(String orderId) async {
    final response = await _api.post(ApiEndpoints.orderShare(orderId));
    final path = _data(response.data)['path']?.toString() ?? '';
    if (!path.startsWith('/share/')) throw StateError('bad share path');
    return shareUri(_apiBaseUrl, path);
  }

  /// `https://host/api/v1` + `/share/<token>` — asosning oxiridagi `/` ikkilanmaydi.
  static Uri shareUri(String apiBaseUrl, String path) {
    final base = apiBaseUrl.endsWith('/') ? apiBaseUrl.substring(0, apiBaseUrl.length - 1) : apiBaseUrl;
    return Uri.parse('$base$path');
  }
}
