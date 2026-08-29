import 'dart:math' as math;

import 'package:latlong2/latlong.dart';

/// Haydovchi markerini ikki GPS fiksi orasida silliq suradigan sof mantiq.
///
/// Joylashuv serverdan har 3–5 soniyada keladi. Uni to'g'ridan-to'g'ri
/// markerga bersak, mashina xaritada sakraydi — ilova "arzon" ko'rinishining
/// asosiy sababi shu. Yandex Go, Uber va Bolt'da mashina uzluksiz suzadi,
/// chunki ular kelgan nuqtalar orasini to'ldiradi.
///
/// Vidjetdan mustaqil: soat tashqaridan beriladi, shuning uchun to'liq
/// sinaladi va xarita dvigatelidan qat'i nazar ishlaydi.
class MarkerAnimation {
  MarkerAnimation({
    required LatLng start,
    this.duration = const Duration(milliseconds: 1200),
    this.teleportThresholdMeters = 500,
  })  : _from = start,
        _to = start,
        _elapsed = duration;

  /// Bir fiksdan ikkinchisiga o'tish vaqti. Fikslar oralig'idan qisqaroq
  /// bo'lgani ma'qul — aks holda marker doim orqada qoladi.
  final Duration duration;

  /// Shundan uzoq sakrash animatsiya qilinmaydi: bu GPS shovqini emas, aloqa
  /// uzilib qayta ulangan yoki haydovchi almashgan holat. Mashinani shahar
  /// bo'ylab sekin suzdirib o'tkazish noto'g'ri ko'rinadi.
  final double teleportThresholdMeters;

  LatLng _from;
  LatLng _to;
  Duration _elapsed;
  double? _bearing;

  /// Harakat yo'nalishi (shimoldan soat strelkasi bo'yicha, gradus).
  /// Birinchi haqiqiy siljishgacha null — yo'nalish uchun ikki nuqta kerak.
  double? get bearing => _bearing;

  bool get isAnimating => _elapsed < duration;

  /// Hozirgi ko'rinishi kerak bo'lgan nuqta.
  LatLng get value {
    if (_elapsed >= duration) return _to;
    final t = _elapsed.inMicroseconds / duration.inMicroseconds;
    return LatLng(
      _from.latitude + (_to.latitude - _from.latitude) * t,
      _from.longitude + (_to.longitude - _from.longitude) * t,
    );
  }

  /// Serverdan yangi fiks kelganda chaqiriladi.
  ///
  /// Animatsiya o'rtasida kelsa, hozirgi ko'rinib turgan joydan davom etadi —
  /// aks holda marker orqaga sakraydi.
  void retarget(LatLng target) {
    if (target.latitude == _to.latitude && target.longitude == _to.longitude) {
      return;
    }

    final current = value;
    final jump = _distanceMeters(current, target);

    if (jump > teleportThresholdMeters) {
      _from = target;
      _to = target;
      _elapsed = duration;
      return;
    }

    // Juda kichik siljishlar (GPS shovqini) yo'nalishni beqaror qiladi.
    if (jump > 3) {
      _bearing = bearingBetween(current, target);
    }

    _from = current;
    _to = target;
    _elapsed = Duration.zero;
  }

  /// Ticker'dan kelgan vaqt qadami. `true` qaytarsa, marker qayta chizilishi
  /// kerak.
  bool advance(Duration delta) {
    if (_elapsed >= duration) return false;
    _elapsed += delta;
    return true;
  }

  /// Haversine — metrlarda.
  static double _distanceMeters(LatLng a, LatLng b) {
    const earthRadius = 6371000.0;
    final dLat = (b.latitude - a.latitude) * math.pi / 180;
    final dLng = (b.longitude - a.longitude) * math.pi / 180;
    final lat1 = a.latitude * math.pi / 180;
    final lat2 = b.latitude * math.pi / 180;

    final h = math.pow(math.sin(dLat / 2), 2) +
        math.cos(lat1) * math.cos(lat2) * math.pow(math.sin(dLng / 2), 2);

    return 2 * earthRadius * math.asin(math.sqrt(h));
  }

  /// Shimoldan soat strelkasi bo'yicha gradus — mashina ikonasini burish uchun.
  static double bearingBetween(LatLng from, LatLng to) {
    final lat1 = from.latitude * math.pi / 180;
    final lat2 = to.latitude * math.pi / 180;
    final dLng = (to.longitude - from.longitude) * math.pi / 180;

    final y = math.sin(dLng) * math.cos(lat2);
    final x = math.cos(lat1) * math.sin(lat2) -
        math.sin(lat1) * math.cos(lat2) * math.cos(dLng);

    return (math.atan2(y, x) * 180 / math.pi + 360) % 360;
  }
}
