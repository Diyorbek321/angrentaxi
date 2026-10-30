import 'dart:math' as math;

import 'package:latlong2/latlong.dart';

/// GPS nuqtasining marshrutga proyeksiyasi.
class RouteProjection {
  const RouteProjection({
    required this.segmentIndex,
    required this.snapped,
    required this.offRouteMeters,
    required this.remainingMeters,
  });

  /// Nuqta yotgan bo'lak: `points[segmentIndex]` → `points[segmentIndex + 1]`.
  final int segmentIndex;

  /// Marshrutdagi eng yaqin nuqta.
  final LatLng snapped;

  /// GPS nuqtasidan marshrutgacha masofa (metr).
  final double offRouteMeters;

  /// [snapped] dan marshrut oxirigacha YO'L bo'yicha (metr).
  final double remainingMeters;
}

/// Haydovchining marshrutdagi o'rni — sof geometriya, to'liq sinaladi.
///
/// Ilgari qolgan masofa to'g'ri chiziq bo'yicha hisoblanardi: burilishli
/// yo'lda raqam haqiqatdan ancha kam chiqardi, chizilgan chiziq esa
/// mashina ortida ham qolib, "qayerdaman" ni chalkashtirardi.
///
/// Masofalar kichik (shahar ichida) bo'lgani uchun har bo'lakda tekis
/// (ekvirektangulyar) yaqinlashish ishlatiladi — xato santimetrlarda.
class RouteProgress {
  RouteProgress(List<LatLng> points)
      : _points = List.unmodifiable(points),
        _suffix = _suffixLengths(points);

  final List<LatLng> _points;

  /// `_suffix[i]` — `points[i]` dan oxirigacha yo'l uzunligi.
  final List<double> _suffix;

  static const double _earthRadius = 6371008.8;

  double get totalMeters => _suffix.isEmpty ? 0 : _suffix.first;

  RouteProjection project(LatLng position) {
    if (_points.length < 2) {
      final only = _points.isEmpty ? position : _points.first;
      return RouteProjection(
        segmentIndex: 0,
        snapped: only,
        offRouteMeters: _meters(position, only),
        remainingMeters: 0,
      );
    }

    var best = double.infinity;
    var bestIndex = 0;
    var bestT = 0.0;
    for (var i = 0; i < _points.length - 1; i++) {
      final (t, d) = _projectOnSegment(position, _points[i], _points[i + 1]);
      if (d < best) {
        best = d;
        bestIndex = i;
        bestT = t;
      }
    }

    final a = _points[bestIndex];
    final b = _points[bestIndex + 1];
    final snapped = LatLng(
      a.latitude + (b.latitude - a.latitude) * bestT,
      a.longitude + (b.longitude - a.longitude) * bestT,
    );
    return RouteProjection(
      segmentIndex: bestIndex,
      snapped: snapped,
      offRouteMeters: best,
      remainingMeters: _meters(snapped, b) + _suffix[bestIndex + 1],
    );
  }

  /// Mashinadan oxirigacha chiziladigan qism.
  List<LatLng> remainingPoints(RouteProjection projection) {
    if (_points.length < 2) return _points;
    return [projection.snapped, ..._points.sublist(projection.segmentIndex + 1)];
  }

  /// Nuqtaning [a]→[b] bo'lagidagi parametri (0..1) va unga masofa (metr).
  static (double, double) _projectOnSegment(LatLng p, LatLng a, LatLng b) {
    final cosLat = math.cos(_rad(a.latitude));
    // Metrlardagi tekis koordinatalar, [a] boshlang'ich nuqta.
    final bx = _rad(b.longitude - a.longitude) * cosLat * _earthRadius;
    final by = _rad(b.latitude - a.latitude) * _earthRadius;
    final px = _rad(p.longitude - a.longitude) * cosLat * _earthRadius;
    final py = _rad(p.latitude - a.latitude) * _earthRadius;

    final len2 = bx * bx + by * by;
    final t = len2 == 0 ? 0.0 : ((px * bx + py * by) / len2).clamp(0.0, 1.0);
    final dx = px - bx * t;
    final dy = py - by * t;
    return (t, math.sqrt(dx * dx + dy * dy));
  }

  static List<double> _suffixLengths(List<LatLng> points) {
    final out = List<double>.filled(points.length, 0);
    for (var i = points.length - 2; i >= 0; i--) {
      out[i] = out[i + 1] + _meters(points[i], points[i + 1]);
    }
    return out;
  }

  static const Distance _distance = Distance();
  static double _meters(LatLng a, LatLng b) =>
      _distance.as(LengthUnit.Meter, a, b);

  static double _rad(double deg) => deg * math.pi / 180;
}
