// DemandProvider — talab xaritasi ekranining holati.
//
// Tekshiriladigan xatti-harakatlar:
//   • GET /surge/zones aynan kontrakt parametrlari bilan chaqiriladi
//   • jim (silent) yangilash xato bersa, ekrandagi eski zonalar YO'QOLMAYDI
//   • `dispose` dan keyin taymer ham, `notifyListeners` ham ishlamaydi
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/driver/demand_provider.dart';
import 'package:angren_taxi/shared/models/demand_zone.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Haqiqiy geolocator platforma kanali `flutter test` da mavjud emas —
/// qat'iy fiks beramiz (test/widget/driver_trip_screen_test.dart naqshi).
class _FakeLocationService extends LocationService {
  _FakeLocationService({this.position});

  final Position? position;

  @override
  Future<Position?> getCurrentPosition() async => position;
}

Position _fix() => Position(
      latitude: 41.0212,
      longitude: 70.0795,
      timestamp: DateTime(2026, 8, 19, 10),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

Response<dynamic> _zonesResponse(List<String> levels) => Response<dynamic>(
      requestOptions: RequestOptions(path: ApiEndpoints.surgeZones),
      statusCode: 200,
      data: {
        'type': 'FeatureCollection',
        'features': [
          for (var i = 0; i < levels.length; i++)
            {
              'type': 'Feature',
              'geometry': {
                'type': 'Polygon',
                'coordinates': [
                  [
                    [70.07, 41.02],
                    [70.08, 41.02],
                    [70.08, 41.03],
                    [70.07, 41.02],
                  ],
                ],
              },
              'properties': {
                'zone': 'h3-$i',
                'level': levels[i],
                'multiplier': 1.7,
              },
            },
        ],
      },
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;

  setUp(() {
    apiClient = MockApiClient();
  });

  DemandProvider build({Position? position}) => DemandProvider(
        apiClient: apiClient,
        locationService: _FakeLocationService(position: position),
      );

  test('lat/lng/rings parametrlari bilan /surge/zones chaqiriladi', () async {
    when(() => apiClient.get(any(), params: any(named: 'params')))
        .thenAnswer((_) async => _zonesResponse(['high', 'elevated']));

    final provider = build(position: _fix());
    await provider.refresh();

    final captured = verify(
      () => apiClient.get(
        ApiEndpoints.surgeZones,
        params: captureAny(named: 'params'),
      ),
    ).captured.single as Map<String, dynamic>;

    expect(captured['lat'], 41.0212);
    expect(captured['lng'], 70.0795);
    expect(captured['rings'], DemandProvider.rings);
    expect(provider.state, DemandProviderState.success);
    expect(provider.zones.highCount, 1);
    expect(provider.zones.elevatedCount, 1);
    expect(provider.updatedAt, isNotNull);

    provider.dispose();
  });

  test('joylashuv yo\'q bo\'lsa — tushunarli xato, so\'rov yuborilmaydi',
      () async {
    final provider = build();
    await provider.refresh();

    expect(provider.state, DemandProviderState.error);
    expect(provider.error, contains('GPS'));
    verifyNever(() => apiClient.get(any(), params: any(named: 'params')));

    provider.dispose();
  });

  test('jim yangilashdagi xato eski zonalarni o\'chirmaydi', () async {
    when(() => apiClient.get(any(), params: any(named: 'params')))
        .thenAnswer((_) async => _zonesResponse(['high']));

    final provider = build(position: _fix());
    await provider.refresh();
    expect(provider.zones.highCount, 1);

    when(() => apiClient.get(any(), params: any(named: 'params'))).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.surgeZones),
        type: DioExceptionType.connectionError,
      ),
    );
    await provider.refresh(silent: true);

    // Holat `success` bo'lib qoladi — xarita bo'shab qolmaydi, lekin
    // xabar ekranda "yangilanmadi" ogohlantirishi sifatida chiqadi.
    expect(provider.state, DemandProviderState.success);
    expect(provider.zones.highCount, 1);
    expect(provider.error, isNotNull);

    provider.dispose();
  });

  test('ma\'lumot yo\'q paytdagi xato to\'liq xato holatini beradi', () async {
    when(() => apiClient.get(any(), params: any(named: 'params'))).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.surgeZones),
        type: DioExceptionType.connectionError,
      ),
    );

    final provider = build(position: _fix());
    await provider.refresh();

    expect(provider.state, DemandProviderState.error);
    expect(provider.error, isNotNull);
    expect(provider.hasData, isFalse);

    provider.dispose();
  });

  test('start() taymerni yoqadi, dispose() uni to\'xtatadi', () async {
    when(() => apiClient.get(any(), params: any(named: 'params')))
        .thenAnswer((_) async => _zonesResponse(['elevated']));

    final provider = build(position: _fix());
    await provider.start();
    expect(provider.isAutoRefreshing, isTrue);

    provider.dispose();
    expect(provider.isAutoRefreshing, isFalse);

    // `dispose` dan keyin notifyListeners chaqirilsa Flutter xato beradi —
    // provayder buni o'zi to'sishi kerak (kechikkan javob keladigan holat).
    await provider.refresh();
  });

  test('pause/resume avtomatik yangilashni boshqaradi', () async {
    when(() => apiClient.get(any(), params: any(named: 'params')))
        .thenAnswer((_) async => _zonesResponse(['high']));

    final provider = build(position: _fix());
    await provider.start();

    provider.pauseAutoRefresh();
    expect(provider.isAutoRefreshing, isFalse);

    provider.resumeAutoRefresh();
    expect(provider.isAutoRefreshing, isTrue);

    provider.dispose();
  });

  test('bo\'sh javob — bo\'sh holat (hech qayerda talab yuqori emas)',
      () async {
    when(() => apiClient.get(any(), params: any(named: 'params')))
        .thenAnswer((_) async => _zonesResponse(['normal', 'normal']));

    final provider = build(position: _fix());
    await provider.refresh();

    expect(provider.state, DemandProviderState.success);
    expect(provider.zones.isEmpty, isTrue);
    expect(provider.zones.zones, isEmpty);
    expect(provider.hasData, isTrue);
    expect(DemandZones.empty.isEmpty, isTrue);

    provider.dispose();
  });
}
