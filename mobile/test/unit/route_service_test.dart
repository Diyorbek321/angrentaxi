// RouteService fetches real road-route geometry from OSRM to replace the
// old straight-line-only polyline drawn between pickup and dropoff.
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:mocktail/mocktail.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late MockDio dio;
  late RouteService service;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
  });

  setUp(() {
    dio = MockDio();
    service = RouteService(dio: dio);
  });

  test('parses OSRM geojson geometry, distance (m->km) and duration (s->min)', () async {
    when(() => dio.get<Map<String, dynamic>>(
          any(),
          queryParameters: any(named: 'queryParameters'),
        )).thenAnswer(
      (_) async => Response<Map<String, dynamic>>(
        requestOptions: RequestOptions(path: ''),
        data: {
          'routes': [
            {
              'distance': 5200.0,
              'duration': 720.0,
              'geometry': {
                'coordinates': [
                  [70.9432, 40.0956],
                  [70.9460, 40.1000],
                  [70.9500, 40.1050],
                ],
              },
            },
          ],
        },
      ),
    );

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

  test('returns null (not a throw) when OSRM has no route', () async {
    when(() => dio.get<Map<String, dynamic>>(
          any(),
          queryParameters: any(named: 'queryParameters'),
        )).thenAnswer(
      (_) async => Response<Map<String, dynamic>>(
        requestOptions: RequestOptions(path: ''),
        data: {'routes': []},
      ),
    );

    final result = await service.getRoute(
      const LatLng(0, 0),
      const LatLng(1, 1),
    );

    expect(result, isNull);
  });

  test('returns null on network failure instead of throwing', () async {
    when(() => dio.get<Map<String, dynamic>>(
          any(),
          queryParameters: any(named: 'queryParameters'),
        )).thenThrow(DioException(requestOptions: RequestOptions(path: '')));

    final result = await service.getRoute(
      const LatLng(0, 0),
      const LatLng(1, 1),
    );

    expect(result, isNull);
  });
}
