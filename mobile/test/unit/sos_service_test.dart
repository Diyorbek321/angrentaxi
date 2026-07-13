// Unit tests for SosService (mobile/lib/core/safety/sos_service.dart),
// which wraps POST /orders/:orderId/sos (backend/src/modules/safety) —
// see safety.controller.ts + safety.service.ts.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/safety/sos_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _jsonResponse(String path, Map<String, dynamic> data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

DioException _badRequest(String path, String message) {
  return DioException(
    requestOptions: RequestOptions(path: path),
    type: DioExceptionType.badResponse,
    response: Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      statusCode: 403,
      data: {'success': false, 'message': message},
    ),
  );
}

void main() {
  late MockApiClient apiClient;
  late SosService service;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
  });

  setUp(() {
    apiClient = MockApiClient();
    service = SosService(apiClient: apiClient);
  });

  test('reportSos posts lat/lng to /orders/:orderId/sos', () async {
    const orderJson = {
      'id': 'sos-1',
      'orderId': 'order-1',
      'reportedByUserId': 'passenger-1',
      'reportedByRole': 'passenger',
      'lat': 41.0167,
      'lng': 70.1436,
      'status': 'active',
      'createdAt': '2026-07-13T10:00:00.000Z',
      'resolvedAt': null,
    };
    when(() => apiClient.post(
          ApiEndpoints.reportSos('order-1'),
          data: any(named: 'data'),
        )).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.reportSos('order-1'), orderJson),
    );

    await service.reportSos(orderId: 'order-1', lat: 41.0167, lng: 70.1436);

    final captured = verify(() => apiClient.post(
          ApiEndpoints.reportSos('order-1'),
          data: captureAny(named: 'data'),
        )).captured.single as Map<String, dynamic>;

    expect(captured['lat'], 41.0167);
    expect(captured['lng'], 70.1436);
  });

  test('reportSos throws SosException with the server message on failure', () async {
    when(() => apiClient.post(
          ApiEndpoints.reportSos('order-2'),
          data: any(named: 'data'),
        )).thenThrow(_badRequest(
      ApiEndpoints.reportSos('order-2'),
      'Not a party to this order',
    ));

    expect(
      () => service.reportSos(orderId: 'order-2', lat: 41.0, lng: 70.0),
      throwsA(
        isA<SosException>().having(
          (e) => e.message,
          'message',
          'Not a party to this order',
        ),
      ),
    );
  });
}
