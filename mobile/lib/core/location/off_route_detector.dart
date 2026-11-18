import 'dart:math' as math;

import 'package:latlong2/latlong.dart';

/// Haydovchi marshrut chizig'idan chiqib ketganini aniqlaydi.
///
/// [NavigationEngine] faqat MANEVR nuqtalarini kuzatadi: haydovchi boshqa
/// ko'chaga burilib ketsa, u eski burilishlar haqida gapiraveradi. Bu sinf
/// esa har ping'da chiziqgacha bo'lgan eng qisqa masofani o'lchaydi va
/// marshrutni QAYTA HISOBLASH vaqti kelganini aytadi.
///
/// Sof Dart — soat ham, joylashuv ham tashqaridan, ya'ni to'liq testlanadi.
class OffRouteDetector {
  OffRouteDetector(List<LatLng> route) : _route = List.unmodifiable(route);

  /// Chiziqdan shuncha uzoqda — "chetda". Shahar GPS xatosi ±10–25 m,
  /// keng ko'chaning qarama-qarshi chekkasi ~20 m; 60 m ikkalasidan ham
  /// aniq katta.
  static const double thresholdMeters = 60;

  /// Ketma-ket shuncha ping chetda bo'lsa — haqiqatan chiqib ketgan.
  /// Bitta yomon fiks (bino orasi) qayta hisoblashga sabab bo'lmasin.
  static const int confirmations = 3;

  /// Qayta hisoblashlar orasidagi eng kam vaqt. Yangi marshrut kelguncha
  /// yoki OSRM javob bermasa, har ping'da so'rov yuborilmasin.
  static const Duration cooldown = Duration(seconds: 20);

  final List<LatLng> _route;
  int _offCount = 0;
  DateTime? _lastReportAt;

  /// Yangi ping. `true` — marshrutni hozir qayta hisoblash kerak.
  bool update(LatLng position, DateTime now) {
    if (_route.length < 2) return false;

    if (distanceToRouteMeters(position) <= thresholdMeters) {
      _offCount = 0;
      return false;
    }

    _offCount++;
    if (_offCount < confirmations) return false;

    final last = _lastReportAt;
    if (last != null && now.difference(last) < cooldown) return false;

    _lastReportAt = now;
    _offCount = 0;
    return true;
  }

  /// Nuqtadan marshrut siniq chizig'igacha eng qisqa masofa (metr).
  double distanceToRouteMeters(LatLng p) {
    var best = double.infinity;
    for (var i = 1; i < _route.length; i++) {
      final d = _distanceToSegment(p, _route[i - 1], _route[i]);
      if (d < best) best = d;
    }
    return best;
  }

  /// Mahalliy tekis proyeksiya (nuqta atrofida): shahar masshtabida
  /// (bir necha km) xatosi santimetrlarda.
  static double _distanceToSegment(LatLng p, LatLng a, LatLng b) {
    const metersPerDegLat = 111320.0;
    final metersPerDegLng = metersPerDegLat * math.cos(p.latitude * math.pi / 180);
    double x(LatLng q) => (q.longitude - p.longitude) * metersPerDegLng;
    double y(LatLng q) => (q.latitude - p.latitude) * metersPerDegLat;

    final ax = x(a), ay = y(a), bx = x(b), by = y(b);
    final dx = bx - ax, dy = by - ay;
    final lengthSq = dx * dx + dy * dy;
    // p — koordinata boshida (0, 0).
    final t = lengthSq == 0 ? 0.0 : (-(ax * dx + ay * dy) / lengthSq).clamp(0.0, 1.0);
    final cx = ax + t * dx, cy = ay + t * dy;
    return math.sqrt(cx * cx + cy * cy);
  }
}
