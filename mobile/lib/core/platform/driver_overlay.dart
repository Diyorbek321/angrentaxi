import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Haydovchi ilovasining Android tomoni: suzuvchi tugma, ilovani ekranga
/// chiqarish va zakaz bildirishnomasi
/// (`android/app/src/main/kotlin/uz/angren/taxi/DriverOverlay.kt`).
///
/// Har bir chaqiruv XAVFSIZ: kanal yo'q bo'lsa (testlar, iOS) `false`/jim —
/// bu qatlam yordamchi, uning yiqilishi zakaz oqimini buzmasligi kerak.
class DriverOverlay {
  const DriverOverlay([this._channel = const MethodChannel('uz.angren.taxi/driver_overlay')]);

  final MethodChannel _channel;

  Future<bool> _bool(String method, [Map<String, Object?>? args]) async {
    try {
      return await _channel.invokeMethod<bool>(method, args) ?? false;
    } catch (e) {
      debugPrint('[Overlay] $method: $e');
      return false;
    }
  }

  Future<void> _call(String method, [Map<String, Object?>? args]) async {
    try {
      await _channel.invokeMethod<void>(method, args);
    } catch (e) {
      debugPrint('[Overlay] $method: $e');
    }
  }

  /// "Boshqa ilovalar ustida ko'rsatish" ruxsati bormi.
  Future<bool> canDrawOverlays() => _bool('canDrawOverlays');
  Future<void> openOverlaySettings() => _call('openOverlaySettings');

  /// Xiaomi/Redmi/POCO — MIUI'ning qo'shimcha ruxsati haqida ko'rsatma uchun.
  Future<bool> isXiaomiFamily() => _bool('isXiaomiFamily');

  Future<bool> showBubble() => _bool('showBubble');
  Future<void> hideBubble() => _call('hideBubble');

  /// Ilovani old planga chiqaradi. `true` — so'rov yuborildi (Android uni
  /// baribir jim rad etishi mumkin; shuning uchun bildirishnoma ham chiqadi).
  Future<bool> bringToFront() => _bool('bringToFront');

  /// [offerId] — native tomon shu taklifni data-only FCM orqali ham olsa
  /// (OfferPushReceiver), ikkinchi marta jiringlamaydi.
  Future<void> showOfferNotification({
    required String title,
    required String text,
    required String channel,
    String? offerId,
  }) =>
      _call('showOfferNotification', {
        'title': title,
        'text': text,
        'channel': channel,
        'offerId': offerId,
      });

  Future<void> cancelOfferNotification() => _call('cancelOfferNotification');

  /// Taklif hal bo'ldi (qabul / rad / muddati o'tdi): bloklangan ekran
  /// ustida ko'rsatish to'xtaydi. Telefon qulflangan bo'lsa, avval qulfni
  /// ochish so'raladi — haydovchi safarga ilovada davom etadi.
  Future<void> releaseLockScreen() => _call('releaseLockScreen');
}
