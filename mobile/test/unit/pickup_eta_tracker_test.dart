// Yo'lovchi ekranidagi "haydovchi N daqiqada keladi" — haqiqiy yo'l (OSRM)
// bo'yicha, to'g'ri chiziq bo'yicha emas. Marshrut serverni bosmaslik uchun
// siyrak so'raladi; oraliqda ETA haydovchi yaqinlashganiga qarab kamayadi.
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/features/passenger/pickup_eta_tracker.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

class _FakeRoutes implements RouteService {
  _FakeRoutes({this.result});

  RouteResult? result;
  int calls = 0;

  @override
  Future<RouteResult?> getRoute(
    LatLng from,
    LatLng to, {
    List<LatLng> waypoints = const [],
  }) async {
    calls++;
    return result;
  }
}

const _pickup = LatLng(41.0100, 70.1400);

/// [_pickup] dan shimolga [meters] metr.
LatLng _north(double meters) =>
    LatLng(_pickup.latitude + meters / 111194.9, _pickup.longitude);

void main() {
  late DateTime now;
  late _FakeRoutes routes;
  late PickupEtaTracker tracker;

  setUp(() {
    now = DateTime(2026, 10, 30, 12);
    routes = _FakeRoutes(
      result: RouteResult(
        points: [_north(2000), _pickup],
        distanceKm: 2.6,
        durationMin: 8,
      ),
    );
    tracker = PickupEtaTracker(routes: routes, clock: () => now);
  });

  tearDown(() => tracker.dispose());

  test('ETA marshrut davomiyligidan olinadi va chiziq beriladi', () async {
    await tracker.update(_north(2000), _pickup);
    expect(tracker.etaMinutes, 8);
    expect(tracker.routePoints, isNotEmpty);
  });

  test('marshrut so\'rovlari orasida ETA yaqinlashishga qarab kamayadi', () async {
    await tracker.update(_north(2000), _pickup);
    now = now.add(const Duration(seconds: 10));
    await tracker.update(_north(1800), _pickup);
    expect(routes.calls, 1, reason: 'har ping\'da server bosilmaydi');
    // 8 daqiqa × 1800/2000.
    expect(tracker.etaMinutes, 7);
  });

  test('haydovchi uzoqqa surilsa yoki vaqt o\'tsa marshrut qayta so\'raladi', () async {
    await tracker.update(_north(2000), _pickup);
    now = now.add(PickupEtaTracker.refreshInterval);
    await tracker.update(_north(1990), _pickup);
    expect(routes.calls, 2);

    await tracker.update(
      _north(1990 - PickupEtaTracker.refreshDistanceMeters - 10),
      _pickup,
    );
    expect(routes.calls, 3);
  });

  test('marshrut kelmasa to\'g\'ri chiziq yo\'l koeffitsiyenti bilan hisoblanadi', () async {
    routes.result = null;
    await tracker.update(_north(2000), _pickup);
    // 2 km × 1.3 = 2.6 km, 25 km/soat → 6.24 daqiqa.
    expect(tracker.etaMinutes, 6);
    expect(tracker.routePoints, isEmpty);
  });

  test('ETA kamida 1 daqiqa', () async {
    await tracker.update(_north(200), _pickup);
    await tracker.update(_north(5), _pickup);
    expect(tracker.etaMinutes, 1);
  });

  test('qayta so\'rashda marshrut kelmasa eskisi saqlanadi', () async {
    await tracker.update(_north(2000), _pickup);
    routes.result = null;
    now = now.add(PickupEtaTracker.refreshInterval);
    await tracker.update(_north(1900), _pickup);
    expect(routes.calls, 2);
    expect(tracker.routePoints, isNotEmpty);
    // 8 × 1900/2000 = 7.6.
    expect(tracker.etaMinutes, 8);
  });
}
