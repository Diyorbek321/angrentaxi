import 'package:angren_taxi/core/location/heading_tracker.dart';
import 'package:angren_taxi/core/location/speed_cameras.dart';
import 'package:angren_taxi/core/location/voice_guide.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

/// Haydovchi ekranlaridagi kamera ogohlantirishi: GPS → [SpeedCameraWatcher]
/// → banner ([alert]) va bir martalik ovoz.
///
/// Navigatsiya (olishga borish) va safar ekrani ikkalasi ham ishlatadi —
/// shaharlararo qatnovda kameralar aynan safar ekranida uchraydi.
class SpeedCameraController extends ChangeNotifier {
  SpeedCameraController({
    required VoiceGuide voice,
    Future<List<SpeedCamera>> Function()? loadCameras,
  }) : _voice = voice {
    (loadCameras ?? _loadAsset)().then((cameras) {
      if (!_disposed) _watcher = SpeedCameraWatcher(cameras);
    }).catchError((Object e) {
      // Baza o'qilmasa navigatsiya baribir ishlaydi — faqat ogohlantirishsiz.
      debugPrint('[SpeedCamera] baza o\'qilmadi: $e');
    });
  }

  static const String asset = 'assets/map/speed_cameras.json';

  /// Baza o'zgarmaydi — ekranlar orasida bir marta o'qiladi.
  static Future<List<SpeedCamera>>? _cache;

  static Future<List<SpeedCamera>> _loadAsset() => _cache ??=
      rootBundle.loadString(asset).then(SpeedCamera.parseAsset);

  final VoiceGuide _voice;
  final HeadingTracker _heading = HeadingTracker();
  SpeedCameraWatcher? _watcher;
  bool _disposed = false;

  SpeedCameraAlert? _alert;
  SpeedCameraAlert? get alert => _alert;

  /// Banner shu qadamda yangilanadi — har 5 m ping'da qayta chizilmasin.
  static const double _distanceStepMeters = 50;

  void onPosition(Position position) {
    final watcher = _watcher;
    if (watcher == null) return;

    final here = LatLng(position.latitude, position.longitude);
    // Ba'zi qurilmalar tezlik bilmasa -1 beradi.
    final speed = position.speed < 0 ? 0.0 : position.speed;
    final heading = _heading.update(here, speed: speed, heading: position.heading);
    final next = watcher.update(here, speedMps: speed, headingDeg: heading);

    if (next != null && next.isNew) _speak(next.camera);

    final previous = _alert;
    _alert = next;
    if (_changed(previous, next)) notifyListeners();
  }

  void _speak(SpeedCamera camera) {
    final l10n = AppL10n.current;
    final limit = camera.maxSpeedKmh;
    _voice.speak(
      limit != null ? l10n.drvCameraSpeak(limit) : l10n.drvCameraSpeakNoLimit,
    );
  }

  static bool _changed(SpeedCameraAlert? a, SpeedCameraAlert? b) {
    if (a == null || b == null) return a != b;
    return a.camera != b.camera ||
        a.overSpeed != b.overSpeed ||
        (a.distanceMeters ~/ _distanceStepMeters) != (b.distanceMeters ~/ _distanceStepMeters);
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
