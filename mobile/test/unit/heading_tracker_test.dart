// Navigator kamerasi va mashina strelkasi uchun yo'nalish: tezlikda GPS
// kompasi (heading), sekin yoki turganda — harakat yo'nalishi, bu ham
// bo'lmasa oxirgi ma'lum yo'nalish (turganda kamera aylanib ketmasin).
import 'package:angren_taxi/core/location/heading_tracker.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

const _origin = LatLng(41.0100, 70.1400);
LatLng _north(double m) => LatLng(_origin.latitude + m / 111194.9, _origin.longitude);
LatLng _east(double m) =>
    LatLng(_origin.latitude, _origin.longitude + m / (111194.9 * 0.7547));

void main() {
  late HeadingTracker tracker;
  setUp(() => tracker = HeadingTracker());

  test('tezlikda GPS heading olinadi', () {
    expect(tracker.update(_origin, speed: 10, heading: 87), 87);
  });

  test('sekin yurganda harakat yo\'nalishi, kichik siljish e\'tiborsiz', () {
    expect(tracker.update(_origin, speed: 0.5, heading: 0), isNull);
    // 3 m — GPS shovqini, yo'nalish chiqarilmaydi.
    expect(tracker.update(_east(3), speed: 0.5, heading: 0), isNull);
    expect(tracker.update(_east(15), speed: 1, heading: 0), closeTo(90, 1));
  });

  test('turganda oxirgi yo\'nalish saqlanadi', () {
    tracker.update(_origin, speed: 10, heading: 45);
    expect(tracker.update(_origin, speed: 0, heading: -1), 45);
  });

  test('noto\'g\'ri heading (manfiy) tezlikda ham e\'tiborsiz', () {
    tracker.update(_origin, speed: 1, heading: 0);
    expect(tracker.update(_north(20), speed: 8, heading: -1), closeTo(0, 1));
  });
}
