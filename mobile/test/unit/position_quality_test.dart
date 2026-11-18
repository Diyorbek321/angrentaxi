// GPS fiks sifati filtri: noaniq (minora/Wi-Fi bo'yicha, yuzlab metr) va
// tartibdan chiqqan (eskiroq) fikslar xaritaga ham, serverga ham bormasin.
import 'package:angren_taxi/core/location/position_quality.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';

Position _fix({required double accuracy, DateTime? at}) => Position(
      latitude: 41.0167,
      longitude: 70.1436,
      timestamp: at ?? DateTime(2026, 10, 30, 12),
      accuracy: accuracy,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

void main() {
  group('PositionQuality.isUsable', () {
    test('aniq fiks o\'tadi', () {
      expect(PositionQuality.isUsable(_fix(accuracy: 8)), isTrue);
    });

    test('chegaradan noaniq fiks tashlanadi', () {
      expect(
        PositionQuality.isUsable(
          _fix(accuracy: PositionQuality.maxAccuracyMeters + 1),
        ),
        isFalse,
      );
    });

    test('aniqligi noma\'lum (0) fiks o\'tadi — ba\'zi qurilmalar bermaydi', () {
      expect(PositionQuality.isUsable(_fix(accuracy: 0)), isTrue);
    });

    test('oldingisidan eskiroq fiks tashlanadi', () {
      final previous = _fix(accuracy: 5, at: DateTime(2026, 10, 30, 12, 0, 10));
      final stale = _fix(accuracy: 5, at: DateTime(2026, 10, 30, 12, 0, 5));
      expect(PositionQuality.isUsable(stale, previous: previous), isFalse);
    });
  });

  group('PositionQuality.better', () {
    test('aniqrog\'i tanlanadi', () {
      final coarse = _fix(accuracy: 400);
      final fine = _fix(accuracy: 12);
      expect(PositionQuality.better(coarse, fine), same(fine));
      expect(PositionQuality.better(fine, coarse), same(fine));
    });

    test('ikkinchisi yo\'q bo\'lsa birinchisi qoladi', () {
      final coarse = _fix(accuracy: 400);
      expect(PositionQuality.better(coarse, null), same(coarse));
    });
  });
}
