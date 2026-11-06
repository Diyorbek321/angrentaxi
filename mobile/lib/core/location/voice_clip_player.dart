import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Oldindan yozib olingan navigatsiya ovoz bo'laklari
/// (`assets/voice/<til>/<id>.mp3`, `tool/generate_voice_clips.py` yaratadi).
///
/// Interfeys — testlarda soxtasi beriladi (asset va platforma kanali
/// `flutter test` da yo'q).
abstract class ClipPlayer {
  /// Shu til uchun o'rnatilgan bo'lak id'lari.
  Future<Set<String>> available(String language);

  /// Bo'laklarni ketma-ket ijro etadi (oldingisi to'xtatiladi).
  Future<bool> play(String language, List<String> clipIds);

  Future<void> stop();
}

class AssetClipPlayer implements ClipPlayer {
  const AssetClipPlayer([this._channel = const MethodChannel('uz.angren.taxi/voice')]);

  final MethodChannel _channel;

  static String _path(String language, String id) => 'assets/voice/$language/$id.mp3';

  @override
  Future<Set<String>> available(String language) async {
    try {
      final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
      final prefix = 'assets/voice/$language/';
      return {
        for (final asset in manifest.listAssets())
          if (asset.startsWith(prefix) && asset.endsWith('.mp3'))
            asset.substring(prefix.length, asset.length - 4),
      };
    } catch (e) {
      debugPrint('[Voice] asset manifest: $e');
      return const {};
    }
  }

  @override
  Future<bool> play(String language, List<String> clipIds) async {
    try {
      return await _channel.invokeMethod<bool>('play', {
            'assets': [for (final id in clipIds) _path(language, id)],
          }) ??
          false;
    } catch (e) {
      debugPrint('[Voice] play: $e');
      return false;
    }
  }

  @override
  Future<void> stop() async {
    try {
      await _channel.invokeMethod<void>('stop');
    } catch (_) {
      // Kanal yo'q (testlar) — to'xtatadigan narsa ham yo'q.
    }
  }
}
