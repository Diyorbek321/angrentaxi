// Haydovchining marshrutdagi o'rni: qolgan masofa YO'L bo'yicha (to'g'ri
// chiziq emas) va chizilgan chiziq mashina ortidan "yeyiladi".
import 'package:angren_taxi/core/location/route_progress.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

const _origin = LatLng(41.0100, 70.1400);
const _metersPerDegLat = 111194.9;

LatLng _north(double m) =>
    LatLng(_origin.latitude + m / _metersPerDegLat, _origin.longitude);

/// [_north(1000)] dan sharqqa [m] metr.
LatLng _corner(double m) => LatLng(
      _north(1000).latitude,
      _origin.longitude + m / (_metersPerDegLat * 0.7547),
    );

void main() {
  // Shimolga 1000 m, keyin sharqqa 1000 m — "L" shakli. To'g'ri chiziq
  // bo'yicha boshidan oxirigacha ~1414 m, yo'l bo'yicha 2000 m.
  final route = RouteProgress([_origin, _north(1000), _corner(1000)]);

  test('umumiy uzunlik yo\'l bo\'yicha', () {
    expect(route.totalMeters, closeTo(2000, 15));
  });

  test('yo\'l ustidagi nuqta — qolgan masofa yo\'l bo\'yicha', () {
    final p = route.project(_north(400));
    expect(p.remainingMeters, closeTo(1600, 15));
    expect(p.offRouteMeters, lessThan(1));
  });

  test('chetroqdagi nuqta yo\'lga yopishtiriladi', () {
    final beside = LatLng(_north(500).latitude, _origin.longitude + 0.0002);
    final p = route.project(beside);
    expect(p.offRouteMeters, closeTo(17, 3));
    expect(p.snapped.longitude, closeTo(_origin.longitude, 1e-6));
    expect(p.remainingMeters, closeTo(1500, 15));
  });

  test('qolgan chiziq mashinadan boshlanadi', () {
    final p = route.project(_north(400));
    final rest = route.remainingPoints(p);
    expect(rest.first.latitude, closeTo(_north(400).latitude, 1e-6));
    expect(rest.last, _corner(1000));
    expect(rest, hasLength(3));
  });

  test('ikkinchi bo\'lakdagi nuqta', () {
    final p = route.project(_corner(250));
    expect(p.remainingMeters, closeTo(750, 15));
    expect(route.remainingPoints(p), hasLength(2));
  });

  test('bitta nuqtali marshrut yiqilmaydi', () {
    final single = RouteProgress([_origin]);
    final p = single.project(_north(10));
    expect(p.remainingMeters, 0);
    expect(single.remainingPoints(p), [_origin]);
  });
}
