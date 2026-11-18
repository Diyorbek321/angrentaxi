import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/models/vehicle_change_request.dart';

/// Mashina almashtirish so'rovlari uchun yupqa qatlam.
///
/// `DriverProvider` ga qo'shilmadi: u allaqachon katta, bu esa profil
/// ekranidan bir marta ochiladigan mustaqil oqim.
class VehicleChangeService {
  VehicleChangeService(this._api);

  final ApiClient _api;

  /// Oxirgi so'rov; hech qachon yuborilmagan bo'lsa `null`.
  Future<VehicleChangeRequest?> latest() async {
    final response = await _api.get(ApiEndpoints.driverVehicleChange);
    final data = (response.data as Map<String, dynamic>)['data'];
    return data is Map<String, dynamic> ? VehicleChangeRequest.fromJson(data) : null;
  }

  Future<VehicleChangeRequest> submit({
    required String carModel,
    required String carNumber,
    int? carYear,
  }) async {
    final response = await _api.post(
      ApiEndpoints.driverVehicleChange,
      data: {
        'carModel': carModel.trim(),
        'carNumber': carNumber.trim(),
        if (carYear != null) 'carYear': carYear,
      },
    );
    return VehicleChangeRequest.fromJson(
      (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>,
    );
  }
}
