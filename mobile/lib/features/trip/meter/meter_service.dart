import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/trip/meter/meter_reading.dart';

/// Taksometr ko'rsatkichini so'raydi. Hisob butunlay SERVERDA — haydovchi va
/// yo'lovchi bir xil sonni ko'radi va u yakuniy narx formulasi bilan bir xil.
class MeterService {
  MeterService(this._api);

  final ApiClient _api;

  Future<MeterReading> reading(String orderId) async {
    final response = await _api.get(ApiEndpoints.orderMeter(orderId));
    final data = (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
    return MeterReading.fromJson(data);
  }
}
