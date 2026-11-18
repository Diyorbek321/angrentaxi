import 'package:angren_taxi/core/location/speed_cameras.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

/// Kamera ogohlantirishi: faqat OLDINDAGI kamera, har biri bir marta
/// aytiladi, o'tib ketilgach o'chadi.
void main() {
  const distance = Distance();
  // Shimolga qarab ketayotgan mashina; kamera 400 m oldinda.
  const start = LatLng(41.0000, 69.5000);
  final ahead = distance.offset(start, 400, 0);
  final camera = SpeedCamera(lat: ahead.latitude, lng: ahead.longitude, maxSpeedKmh: 70);

  /// [meters] — startdan shimolga, 20 m/s (72 km/soat) tezlikda.
  SpeedCameraAlert? drive(SpeedCameraWatcher w, double meters, {double speed = 20, double bearing = 0}) {
    final p = distance.offset(start, meters, bearing);
    return w.update(p, speedMps: speed, headingDeg: bearing);
  }

  test('oldindagi kamera — ogohlantirish, birinchi marta isNew', () {
    final w = SpeedCameraWatcher([camera]);
    final first = drive(w, 0)!;
    expect(first.camera, camera);
    expect(first.distanceMeters, closeTo(400, 2));
    expect(first.isNew, isTrue);
    // 72 > 70.
    expect(first.overSpeed, isTrue);

    final second = drive(w, 50)!;
    expect(second.isNew, isFalse);
    expect(second.distanceMeters, closeTo(350, 2));
  });

  test('chegaradan sekin — overSpeed yo\'q', () {
    final w = SpeedCameraWatcher([camera]);
    expect(drive(w, 0, speed: 15)!.overSpeed, isFalse);
  });

  test('orqadagi va yon tomondagi kamera — jim', () {
    final w = SpeedCameraWatcher([camera]);
    // Janubga ketyapti — kamera orqada.
    expect(drive(w, 0, bearing: 180), isNull);
    // Sharqqa ketyapti — kamera 90° yonda.
    expect(drive(w, 0, bearing: 90), isNull);
  });

  test('uzoqdagi kamera — hali jim', () {
    final w = SpeedCameraWatcher([camera]);
    expect(drive(w, -300), isNull);
  });

  test("o'tib ketgach o'chadi va qayta aytilmaydi", () {
    final w = SpeedCameraWatcher([camera]);
    expect(drive(w, 0)!.isNew, isTrue);
    expect(drive(w, 420), isNull);
    // Ozgina orqaga qaytgan GPS sakrashi ham qayta aytmaydi.
    expect(drive(w, 380)?.isNew ?? false, isFalse);
  });

  test('turganda yangi ogohlantirish yo\'q, faol kamera saqlanadi', () {
    final w = SpeedCameraWatcher([camera]);
    expect(drive(w, 0, speed: 0.5), isNull);
    drive(w, 0);
    final stopped = drive(w, 10, speed: 0.5)!;
    expect(stopped.isNew, isFalse);
  });

  test('ikki kameradan yaqinrog\'i tanlanadi', () {
    final near = distance.offset(start, 200, 0);
    final nearCam = SpeedCamera(lat: near.latitude, lng: near.longitude, maxSpeedKmh: null);
    final w = SpeedCameraWatcher([camera, nearCam]);
    final alert = drive(w, 0)!;
    expect(alert.camera, nearCam);
    expect(alert.overSpeed, isFalse);
  });

  test('JSON asset formati o\'qiladi', () {
    final cams = SpeedCamera.parseAsset(
      '{"cameras":[[41.1,69.4,100],[41.2,69.5,null]]}',
    );
    expect(cams, hasLength(2));
    expect(cams.first.maxSpeedKmh, 100);
    expect(cams.last.maxSpeedKmh, isNull);
  });
}
