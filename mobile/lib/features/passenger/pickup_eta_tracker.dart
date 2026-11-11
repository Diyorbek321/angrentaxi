import 'package:angren_taxi/core/location/route_service.dart';
import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';

/// Haydovchi olish nuqtasiga necha daqiqada yetishi — haqiqiy yo'l bo'yicha.
///
/// Ilgari ETA to'g'ri chiziq bo'yicha, soatiga 25 km deb hisoblanardi:
/// daryo yoki temir yo'l ortidagi haydovchi "2 daqiqada" ko'rinib, 10
/// daqiqada kelardi — yo'lovchi ishonchini eng tez yo'qotadigan narsa.
///
/// Marshrut (OSRM) har ping'da EMAS, [refreshInterval] yoki
/// [refreshDistanceMeters] da bir so'raladi (server cheklovi daqiqasiga 30).
/// Oraliqda ETA marshrut davomiyligini haydovchi qancha yaqinlashganiga
/// mutanosib kamaytirib topiladi.
class PickupEtaTracker extends ChangeNotifier {
  PickupEtaTracker({
    required RouteService routes,
    DateTime Function()? clock,
  })  : _routes = routes,
        _clock = clock ?? DateTime.now;

  final RouteService _routes;
  final DateTime Function() _clock;

  static const Duration refreshInterval = Duration(seconds: 60);
  static const double refreshDistanceMeters = 300;

  /// Marshrut kelmaganda: shahar yo'llari to'g'ri chiziqdan ~1.3 marta uzun.
  static const double roadFactor = 1.3;
  static const double fallbackSpeedKmh = 25;

  static const Distance _distance = Distance();

  RouteResult? _route;
  LatLng? _queriedFrom;
  DateTime? _queriedAt;
  double? _straightAtQuery;
  bool _loading = false;
  bool _disposed = false;

  int? _etaMinutes;
  List<LatLng> _routePoints = const [];

  int? get etaMinutes => _etaMinutes;

  /// Haydovchidan olish nuqtasigacha yo'l chizig'i (kelmaguncha bo'sh).
  List<LatLng> get routePoints => _routePoints;

  /// Haydovchining yangi joyi.
  Future<void> update(LatLng driver, LatLng pickup) async {
    if (_needsRefresh(driver) && !_loading) {
      _loading = true;
      try {
        final route = await _routes.getRoute(driver, pickup);
        if (_disposed) return;
        _queriedFrom = driver;
        _queriedAt = _clock();
        // Server javob bermasa eski marshrut qoladi — uning nisbati
        // (`_straightAtQuery`) ham o'sha marshrutga tegishli.
        if (route != null) {
          _route = route;
          _straightAtQuery = _meters(driver, pickup);
          _routePoints = route.points;
        }
      } finally {
        _loading = false;
      }
    }
    _recompute(driver, pickup);
  }

  bool _needsRefresh(LatLng driver) {
    final from = _queriedFrom;
    final at = _queriedAt;
    if (from == null || at == null) return true;
    if (_clock().difference(at) >= refreshInterval) return true;
    return _meters(from, driver) >= refreshDistanceMeters;
  }

  void _recompute(LatLng driver, LatLng pickup) {
    final straight = _meters(driver, pickup);
    final route = _route;
    final atQuery = _straightAtQuery;
    final double minutes;
    if (route != null && atQuery != null && atQuery > 0) {
      minutes = route.durationMin * (straight / atQuery);
    } else {
      minutes = straight * roadFactor / 1000 / fallbackSpeedKmh * 60;
    }
    final eta = minutes.round().clamp(1, 999);
    if (eta == _etaMinutes) return;
    _etaMinutes = eta;
    if (!_disposed) notifyListeners();
  }

  static double _meters(LatLng a, LatLng b) =>
      _distance.as(LengthUnit.Meter, a, b);

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
