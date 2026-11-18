import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/models/lost_item_report.dart';

/// Yo'qolgan buyum xabarlari — yo'lovchi ham, haydovchi ham ishlatadi
/// (`GET /lost-items/mine` rolga qarab o'zinikini qaytaradi).
class LostItemsService {
  LostItemsService(this._api);

  final ApiClient _api;

  Future<List<LostItemReport>> mine() async {
    final response = await _api.get(ApiEndpoints.myLostItems);
    final list = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
    return list
        .map((e) => LostItemReport.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<LostItemReport> report({
    required String orderId,
    required String description,
  }) async {
    final response = await _api.post(
      ApiEndpoints.lostItems,
      data: {'orderId': orderId, 'description': description.trim()},
    );
    return LostItemReport.fromJson(
      (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>,
    );
  }

  Future<LostItemReport> driverRespond(
    String id, {
    required bool found,
    String? note,
  }) async {
    final response = await _api.patch(
      ApiEndpoints.lostItemDriverResponse(id),
      data: {
        'found': found,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
    return LostItemReport.fromJson(
      (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>,
    );
  }
}
