import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Android `FLAG_SECURE`: ekran skrinshotga, ekran yozuviga va "so'nggi
/// ilovalar" ko'rinishiga tushmaydi.
///
/// OTP kodi, to'lov sahifasi (karta raqami, SMS kod) va KYC hujjat
/// rasmlari ochiq turganda yoqiladi. Hisoblagich bilan: ikki himoyalangan
/// ekran ustma-ust ochilsa, ustidagisi yopilganda bayroq o'chib qolmaydi.
class SecureScreen {
  SecureScreen([this._channel = const MethodChannel('uz.angren.taxi/secure')]);

  static SecureScreen instance = SecureScreen();

  final MethodChannel _channel;
  int _holders = 0;

  @visibleForTesting
  int get holders => _holders;

  void acquire() {
    _holders++;
    if (_holders == 1) _set(true);
  }

  void release() {
    if (_holders == 0) return;
    _holders--;
    if (_holders == 0) _set(false);
  }

  void _set(bool secure) {
    if (defaultTargetPlatform != TargetPlatform.android) return;
    _channel
        .invokeMethod<void>('setSecure', {'secure': secure})
        // Kanal yo'q (widget testi, eski build) — himoyasiz davom etiladi.
        .catchError((Object _) {});
  }
}
