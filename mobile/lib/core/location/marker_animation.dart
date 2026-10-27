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
    Duration duration = const Duration(milliseconds: 1200),
    this.teleportThresholdMeters = 500,
    this.clock,
  })  : _from = start,
        _to = start,
        _duration = duration,
        _elapsed = duration;

  /// Bir fiksdan ikkinchisiga o'tish vaqti.
  ///
  /// [clock] berilsa — MOSLASHUVCHAN: fikslar orasidagi haqiqiy vaqtga
  /// (silliqlangan) teng bo'ladi. Qat'iy 1.2 s da fikslar 3–5 s'da kelganda
  /// mashina 1.2 s suzib, 2–4 s turib qolardi ("to'xtab-yurish").
  Duration get duration => _duration;
  Duration _duration;

  /// Moslashuvchan davomiylik uchun soat (`null` — qat'iy davomiylik).
  final DateTime Function()? clock;
  DateTime? _lastFixAt;

  static const Duration _minDuration = Duration(milliseconds: 600);
  static const Duration _maxDuration = Duration(seconds: 5);

  /// Ikona burilishi shundan uzoq davom etmaydi — keskin burilish ham
  /// "aylanib ketish" emas, tez va tabiiy ko'rinadi.
  static const Duration _maxTurn = Duration(milliseconds: 600);
  double? _bearingFrom;

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

  /// Ekranda ko'rsatiladigan yo'nalish: oldingisidan [bearing] gacha eng
  /// qisqa yoy bo'ylab buriladi (ikona bir zumda "sakrab" burilmaydi).
  double? get displayBearing {
    final to = _bearing;
    final from = _bearingFrom;
    if (to == null || from == null) return to;
    final turn = _duration < _maxTurn ? _duration : _maxTurn;
    final t = (_elapsed.inMicroseconds / turn.inMicroseconds).clamp(0.0, 1.0);
    final diff = ((to - from + 540) % 360) - 180;
    return (from + diff * t + 360) % 360;
  }

  bool get isAnimating => _elapsed < _duration;

  /// Hozirgi ko'rinishi kerak bo'lgan nuqta.
  LatLng get value {
    if (_elapsed >= _duration) return _to;
    final t = _elapsed.inMicroseconds / _duration.inMicroseconds;
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

    _adaptDuration();

    if (jump > teleportThresholdMeters) {
      _from = target;
      _to = target;
      _elapsed = _duration;
      _bearingFrom = null;
      return;
    }

    // Juda kichik siljishlar (GPS shovqini) yo'nalishni beqaror qiladi.
    if (jump > 3) {
      _bearingFrom = displayBearing;
      _bearing = bearingBetween(current, target);
    }

    _from = current;
    _to = target;
    _elapsed = Duration.zero;
  }

  /// Ticker'dan kelgan vaqt qadami. `true` qaytarsa, marker qayta chizilishi
  /// kerak.
  bool advance(Duration delta) {
    if (_elapsed >= _duration) return false;
    _elapsed += delta;
    return true;
  }

  /// Fikslar oralig'ining eksponensial o'rtachasi (EMA): bitta kechikkan
  /// fiks animatsiyani keskin sekinlashtirmaydi.
  void _adaptDuration() {
    final now = clock?.call();
    if (now == null) return;
    final last = _lastFixAt;
    _lastFixAt = now;
    if (last == null) return;
    final gapUs = now.difference(last).inMicroseconds;
    if (gapUs <= 0) return;
    final smoothed = (_duration.inMicroseconds * 0.7 + gapUs * 0.3).round();
    _duration = Duration(
      microseconds: smoothed.clamp(
        _minDuration.inMicroseconds,
        _maxDuration.inMicroseconds,
      ),
    );
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
