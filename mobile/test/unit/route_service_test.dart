// RouteService fetches real road-route geometry through the backend's
// `GET /routing/route` (an OSRM proxy) to replace the old straight-line
// polyline drawn between pickup and dropoff.
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _wrapped(Object? route) => Response<dynamic>(
      requestOptions: RequestOptions(path: ''),
      // Global ResponseInterceptor envelope — the route is under `data`.
      data: {'success': true, 'data': route},
    );

Map<String, dynamic> _route({
  double distance = 5200,
  double duration = 720,
  List<List<double>> coordinates = const [
    [70.9432, 40.0956],
    [70.9460, 40.1000],
    [70.9500, 40.1050],
  ],
}) =>
    {
      'distance': distance,
      'duration': duration,
      'geometry': {'type': 'LineString', 'coordinates': coordinates},
      'legs': <dynamic>[],
    };

void main() {
  late MockApiClient api;
  late RouteService service;

  setUp(() {
    api = MockApiClient();
    service = RouteService(api);
  });

  void stubRoute(Object? route) {
    when(() => api.get(any(), params: any(named: 'params')))
        .thenAnswer((_) async => _wrapped(route));
  }

  test('parses geojson geometry, distance (m->km) and duration (s->min)',
      () async {
    stubRoute(_route());

    final result = await service.getRoute(
      const LatLng(40.0956, 70.9432),
      const LatLng(40.1050, 70.9500),
    );

    expect(result, isNotNull);
    expect(result!.distanceKm, 5.2);
    expect(result.durationMin, 12.0);
    expect(result.points.length, 3);
    // geojson is [lon, lat] — must come back as LatLng(lat, lon).
    expect(result.points.first.latitude, 40.0956);
    expect(result.points.first.longitude, 70.9432);
  });

  test('calls the backend proxy, never an OSRM host', () async {
    stubRoute(_route());

    await service.getRoute(const LatLng(40, 70), const LatLng(41, 71));

    final path = verify(() => api.get(captureAny(), params: any(named: 'params')))
        .captured
        .single;
    expect(path, ApiEndpoints.routingRoute);
  });

  test('returns null (not a throw) when there is no route', () async {
    stubRoute(null);
    expect(
      await service.getRoute(const LatLng(0, 0), const LatLng(1, 1)),
      isNull,
    );
  });

  test('returns null on network failure (e.g. 404 no route) instead of throwing',
      () async {
    when(() => api.get(any(), params: any(named: 'params'))).thenThrow(
      DioException(requestOptions: RequestOptions(path: '')),
    );

    expect(
      await service.getRoute(const LatLng(0, 0), const LatLng(1, 1)),
      isNull,
    );
  });

  test('sends coords in order: pickup, each waypoint, dropoff', () async {
    stubRoute(_route());

    const from = LatLng(40.0956, 70.9432);
    const to = LatLng(40.1050, 70.9500);
    const waypoints = [LatLng(40.1000, 70.9460), LatLng(40.1020, 70.9480)];

    await service.getRoute(from, to, waypoints: waypoints);

    final params = verify(() => api.get(any(), params: captureAny(named: 'params')))
        .captured
        .single as Map<String, dynamic>;
    expect((params['coords'] as String).split(';'), [
      '${from.longitude},${from.latitude}',
      '${waypoints[0].longitude},${waypoints[0].latitude}',
      '${waypoints[1].longitude},${waypoints[1].latitude}',
      '${to.longitude},${to.latitude}',
    ]);
  });
}
