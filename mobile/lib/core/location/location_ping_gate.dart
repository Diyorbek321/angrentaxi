import 'package:angren_taxi/core/config/app_config.dart';

/// Joylashuv yuborish tezligini boshqaradi — harakat holatiga qarab.
///
/// Ilgari oqim faqat masofa filtri (10 m) bilan cheklanardi. Bu yo'lovchi eng
/// diqqat bilan qaraydigan holatda buziladi: tirbandlikda mashina 10 m
/// yurmaydi, demak hech narsa yuborilmaydi va yo'lovchi ekranidagi marker
/// muzlab qoladi.
///
/// Endi harakatlanayotgan haydovchi doimiy ritmda xabar beradi (sanoat
/// amaliyoti — 2–5 soniya), turgan haydovchi esa sekin "yurak urishi"ga
/// tushadi: batareya va server yuklamasi tejaladi.
///
/// Sof mantiq — soat ham, GPS ham tashqaridan beriladi, shuning uchun to'liq
/// sinaladi.
class LocationPingGate {
  LocationPingGate({
    Duration? movingInterval,
    Duration? idleInterval,
    double? idleSpeedThreshold,
  })  : _movingInterval = movingInterval ?? AppConfig.locationPingInterval,
        _idleInterval = idleInterval ?? AppConfig.locationIdlePingInterval,
        _idleSpeedThreshold =
            idleSpeedThreshold ?? AppConfig.locationIdleSpeedThreshold;

  final Duration _movingInterval;
  final Duration _idleInterval;
  final double _idleSpeedThreshold;

  DateTime? _lastEmitAt;

  /// Shu fiksni yuborish kerakmi? Chaqiruvchi `true` olganda darhol yuboradi.
  ///
  /// [speedMetersPerSecond] — GPS bergan tezlik. Manfiy yoki noma'lum
  /// qiymatlar (ba'zi qurilmalar -1 qaytaradi) modul bo'yicha olinadi.
  bool shouldEmit({required double speedMetersPerSecond, required DateTime now}) {
    final last = _lastEmitAt;
    if (last == null) {
      _lastEmitAt = now;
      return true;
    }

    final idle = speedMetersPerSecond.abs() < _idleSpeedThreshold;
    final interval = idle ? _idleInterval : _movingInterval;

    if (now.difference(last) < interval) return false;

    _lastEmitAt = now;
    return true;
  }

  /// Haydovchi oflayn bo'lganda chaqiriladi — keyingi onlayn bo'lishda
  /// birinchi fiks darhol ketishi uchun.
  void reset() {
    _lastEmitAt = null;
  }
}
