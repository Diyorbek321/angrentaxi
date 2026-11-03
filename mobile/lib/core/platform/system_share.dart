import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Tizim "Ulashish" oynasi (Android `ACTION_SEND` chooser) —
/// `MainActivity.kt` dagi `uz.angren.taxi/share` kanali.
///
/// NEGA PAKET EMAS: `share_plus` ning firebase bilan sig'adigan versiyasi
/// boshqa bog'liqlikni (`mime`) pastga tushirardi. Kanal topilmasa (iOS,
/// test, eski native) — matn buferga nusxalanadi va `false` qaytadi:
/// chaqiruvchi "nusxalandi" deydi.
class SystemShare {
  const SystemShare([this._channel = const MethodChannel('uz.angren.taxi/share')]);

  static SystemShare instance = const SystemShare();

  final MethodChannel _channel;

  /// `true` — tizim oynasi ochildi; `false` — buferga nusxalandi.
  Future<bool> shareText(String text, {String? title, String? subject}) async {
    try {
      final shown = await _channel.invokeMethod<bool>('shareText', {
        'text': text,
        if (title != null) 'title': title,
        if (subject != null) 'subject': subject,
      });
      if (shown == true) return true;
    } on MissingPluginException {
      // pastda — bufer
    } on PlatformException catch (e) {
      debugPrint('SystemShare failed: ${e.message}');
    }
    await Clipboard.setData(ClipboardData(text: text));
    return false;
  }
}
