import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Telefonning barqaror identifikatori (Android `ANDROID_ID`).
///
/// NEGA KERAK: backend haydovchi o'zi o'ziga zakaz berayotganini aniqlaydi
/// (`backend/src/modules/orders/fraud-rules.ts`). Eng kuchli belgi — buyurtma
/// bergan va qabul qilgan telefon bitta. `ANDROID_ID` bir xil kalit bilan
/// imzolangan ilovalar uchun bir telefonda BIR XIL, ya'ni yo'lovchi va
/// haydovchi ilovasi bitta telefonda bo'lsa mos keladi.
///
/// Bu shaxsiy ma'lumot emas (raqam, ism yo'q) va faqat shu taqqoslash uchun
/// ishlatiladi. Olinmasa (iOS, emulyator, test) — `null`, sarlavha yuborilmaydi.
class DeviceIdentity {
  DeviceIdentity([this._channel = const MethodChannel('uz.angren.taxi/device')]);

  /// Platformaga murojaat qilmaydigan nusxa — testlar uchun
  /// (`test/flutter_test_config.dart`): widget testining soxta vaqtida
  /// platforma kanalini kutish so'rovni osib qo'yardi.
  DeviceIdentity.fixed(String? id)
      : _channel = const MethodChannel('uz.angren.taxi/device'),
        _loaded = true,
        _value = id;

  static DeviceIdentity instance = DeviceIdentity();

  final MethodChannel _channel;
  bool _loaded = false;
  String? _value;
  Future<String?>? _loading;

  /// Birinchi chaqiruv platformadan oladi, keyingilari SINXRON qaytaradi.
  ///
  /// ⚠️ Keshlangan `Future` emas, qiymat: boshqa zonada tugagan Future'ni
  /// kutish widget testining soxta vaqtida hech qachon davom etmaydi va har
  /// bir so'rovni osib qo'yardi.
  Future<String?> id() {
    if (_loaded) return SynchronousFuture<String?>(_value);
    return _loading ??= _load().then((value) {
      _value = value;
      _loaded = true;
      return value;
    });
  }

  Future<String?> _load() async {
    if (defaultTargetPlatform != TargetPlatform.android) return null;
    try {
      final value = await _channel.invokeMethod<String>('deviceId');
      return (value == null || value.isEmpty) ? null : value;
    } catch (_) {
      // Kanal yo'q (testlar) yoki platforma xatosi — tekshiruv shunchaki
      // shu belgisiz ishlaydi, so'rov to'xtamaydi.
      return null;
    }
  }
}
