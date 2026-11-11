import 'package:geolocator/geolocator.dart';

/// GPS fiksining sifat qoidalari — sof mantiq, to'liq sinaladi.
///
/// Ilgari har qanday fiks qabul qilinardi: bino ichida yoki "taxminiy
/// joylashuv" ruxsatida telefon minora/Wi-Fi bo'yicha 1–2 km xato nuqta
/// berardi va u xaritaga ham, serverga ham ketardi (mashina sakrardi,
/// olish nuqtasi qo'shni mahallaga tushardi).
class PositionQuality {
  PositionQuality._();

  /// Bundan noaniq fiks oqimda tashlab yuboriladi. Shahar ko'chasida GPS
  /// odatda 5–20 m; 100 m dan katta — bu allaqachon GPS emas.
  static const double maxAccuracyMeters = 100;

  /// Bir martalik so'rovda shundan yomon fiks kelsa, aniqrog'i yana bir
  /// marta kutiladi.
  static const double goodAccuracyMeters = 50;

  /// Fiksni ishlatsa bo'ladimi.
  ///
  /// Aniqlik `0` — qurilma uni bermagan (ba'zi Android'lar), bunday fiks
  /// rad etilmaydi. [previous] dan eskiroq fiks tashlanadi: oqimda tartib
  /// buzilsa marker orqaga "sakrardi".
  static bool isUsable(Position fix, {Position? previous}) {
    if (fix.accuracy > maxAccuracyMeters) return false;
    if (previous != null && fix.timestamp.isBefore(previous.timestamp)) {
      return false;
    }
    return true;
  }

  /// Ikkisidan aniqrog'i (aniqlik raqami kichigi).
  static Position better(Position a, Position? b) {
    if (b == null) return a;
    return b.accuracy < a.accuracy ? b : a;
  }
}
