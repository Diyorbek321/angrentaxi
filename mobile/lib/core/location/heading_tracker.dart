import 'package:latlong2/latlong.dart';

/// Mashina qaysi tomonga qarab turibdi (gradus, shimoldan soat yo'nalishida).
///
/// GPS `heading` faqat harakatda ishonchli: turgan telefonda u tasodifiy
/// sakraydi va navigator kamerasi joyida aylanib ketardi. Shuning uchun:
///  · [minSpeed] dan tez — GPS heading;
///  · sekinroq — ikki nuqta orasidagi yo'nalish, lekin faqat [minMove] dan
///    uzoq siljiganda (aks holda bu GPS shovqini);
///  · hech biri bo'lmasa — oxirgi ma'lum yo'nalish.
class HeadingTracker {
  static const double minSpeed = 2; // m/s ≈ 7 km/soat
  static const double minMove = 10; // m

  static const Distance _distance = Distance();

  LatLng? _anchor;
  double? _bearing;

  double? get bearing => _bearing;

  double? update(LatLng here, {required double speed, required double heading}) {
    if (speed >= minSpeed && heading >= 0) {
      _bearing = heading % 360;
      _anchor = here;
      return _bearing;
    }
    final anchor = _anchor;
    if (anchor == null) {
      _anchor = here;
      return _bearing;
    }
    if (_distance.as(LengthUnit.Meter, anchor, here) >= minMove) {
      _bearing = _distance.bearing(anchor, here) % 360;
      _anchor = here;
    }
    return _bearing;
  }
}
