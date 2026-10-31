import 'dart:convert';

import 'package:latlong2/latlong.dart';

// ============================================================================
// TEZLIK KAMERALARI HAQIDA OGOHLANTIRISH
//
// Telefon radar signalini ushlay olmaydi — Yandex Navigator va Waze kabi
// biz ham kameralar BAZASI + GPS bilan ishlaymiz. Baza OSM'dan
// (`tool/fetch_speed_cameras.py` → `assets/map/speed_cameras.json`).
//
// Bu fayl SOF mantiq: "qaysi kamera haqida, qachon" qarori. Ovoz va banner
// `SpeedCameraController` da.
//
// ⚠️ OSM `direction` tegi ATAYLAB ishlatilmaydi: u kameraning qarash
// tomonimi yoki nazorat qilinadigan harakat tomonimi — xaritachilar turlicha
// to'ldiradi. Noto'g'ri talqin ogohlantirishni jim yutib yuborardi; ortiqcha
// ogohlantirish undan arzon.
// ============================================================================

class SpeedCamera {
  const SpeedCamera({required this.lat, required this.lng, this.maxSpeedKmh});

  final double lat;
  final double lng;

  /// Belgilangan tezlik chegarasi, OSM'da bo'lmasa `null`.
  final int? maxSpeedKmh;

  LatLng get point => LatLng(lat, lng);

  /// `{"cameras": [[lat, lng, maxSpeedKmh|null], ...]}`.
  static List<SpeedCamera> parseAsset(String json) {
    final doc = jsonDecode(json) as Map<String, dynamic>;
    return [
      for (final row in doc['cameras'] as List)
        SpeedCamera(
          lat: ((row as List)[0] as num).toDouble(),
          lng: (row[1] as num).toDouble(),
          maxSpeedKmh: (row[2] as num?)?.toInt(),
        ),
    ];
  }
}

class SpeedCameraAlert {
  const SpeedCameraAlert({
    required this.camera,
    required this.distanceMeters,
    required this.overSpeed,
    required this.isNew,
  });

  final SpeedCamera camera;
  final double distanceMeters;

  /// Hozirgi tezlik kameraning chegarasidan baland.
  final bool overSpeed;

  /// Shu kamera haqida birinchi ogohlantirish — ovoz faqat shunda.
  final bool isNew;
}

class SpeedCameraWatcher {
  SpeedCameraWatcher(this.cameras);

  final List<SpeedCamera> cameras;

  /// Shu masofadan ogohlantiriladi — 70 km/soatda ~25 soniya.
  static const double warnMeters = 500;

  /// Kamera harakat yo'nalishidan shuncha gradus ichida bo'lsa "oldinda".
  /// Yo'l egri bo'lsa ham ushlaydi, yon ko'chadagi kamerani esa yo'q.
  static const double aheadConeDeg = 35;

  /// Faol kamera shu burchakdan oshsa — o'tib ketildi.
  static const double passedDeg = 90;

  /// Shundan sekin — GPS yo'nalishi ishonchsiz, yangi ogohlantirish yo'q.
  static const double minSpeedMps = 2.5;

  static const Distance _distance = Distance();

  SpeedCamera? _active;
  final Set<SpeedCamera> _announced = {};

  SpeedCameraAlert? update(
    LatLng here, {
    required double speedMps,
    required double? headingDeg,
  }) {
    // Uzoqlashgan kameralar qayta aytilishi mumkin (qaytish yo'li).
    _announced.removeWhere((c) => _meters(here, c) > warnMeters * 2);

    final moving = speedMps >= minSpeedMps && headingDeg != null;

    final active = _active;
    if (active != null) {
      final d = _meters(here, active);
      final passed = moving && _offAxis(here, active, headingDeg) > passedDeg;
      if (passed || d > warnMeters + 100) {
        _active = null;
      } else {
        return _alert(active, d, speedMps, isNew: false);
      }
    }

    if (!moving) return null;

    SpeedCamera? best;
    var bestDistance = double.infinity;
    for (final camera in cameras) {
      if (_announced.contains(camera)) continue;
      final d = _meters(here, camera);
      if (d > warnMeters || d >= bestDistance) continue;
      if (_offAxis(here, camera, headingDeg) > aheadConeDeg) continue;
      best = camera;
      bestDistance = d;
    }
    if (best == null) return null;

    _active = best;
    _announced.add(best);
    return _alert(best, bestDistance, speedMps, isNew: true);
  }

  SpeedCameraAlert _alert(SpeedCamera c, double d, double speedMps, {required bool isNew}) {
    final limit = c.maxSpeedKmh;
    return SpeedCameraAlert(
      camera: c,
      distanceMeters: d,
      overSpeed: limit != null && speedMps * 3.6 > limit,
      isNew: isNew,
    );
  }

  static double _meters(LatLng a, SpeedCamera c) =>
      _distance.as(LengthUnit.Meter, a, c.point);

  /// Harakat yo'nalishi va kameraga yo'nalish orasidagi burchak, 0–180.
  static double _offAxis(LatLng here, SpeedCamera c, double heading) {
    final bearing = _distance.bearing(here, c.point);
    final diff = ((bearing - heading) % 360 + 360) % 360;
    return diff > 180 ? 360 - diff : diff;
  }
}
