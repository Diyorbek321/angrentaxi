import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';

/// Thrown when `POST /orders/:orderId/sos` fails — carries a user-facing
/// message already resolved via [extractErrorMessage].
class SosException implements Exception {
  SosException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Thin wrapper around `POST /orders/:orderId/sos`
/// (backend/src/modules/safety/safety.controller.ts +
/// safety.service.ts). Reports an emergency alert for the given order at the
/// caller's current location; the backend fans it out to dispatchers/managers
/// over the `sos:alert` socket event (see `RealtimeGateway.emitToManagers`).
class SosService {
  SosService({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<void> reportSos({
    required String orderId,
    required double lat,
    required double lng,
  }) async {
    try {
      await _apiClient.post(
        ApiEndpoints.reportSos(orderId),
        data: {
          'lat': lat,
          'lng': lng,
        },
      );
    } catch (e) {
      throw SosException(extractErrorMessage(e));
    }
  }
}
