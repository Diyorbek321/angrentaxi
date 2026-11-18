import 'package:angren_taxi/core/location/speed_cameras.dart';
import 'package:angren_taxi/core/location/voice_clip_player.dart';
import 'package:angren_taxi/core/location/voice_guide.dart';
import 'package:angren_taxi/features/driver/navigation/speed_camera_controller.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

class _RecordingTts implements TtsEngine {
  final spoken = <String>[];
  @override
  Future<List<String>> languages() async => ['uz-UZ'];
  @override
  Future<void> setLanguage(String language) async {}
  @override
  Future<void> setSpeechRate(double rate) async {}
  @override
  Future<void> speak(String text) async => spoken.add(text);
  @override
  Future<void> stop() async {}
}

class _NoClips implements ClipPlayer {
  @override
  Future<Set<String>> available(String language) async => const {};
  @override
  Future<bool> play(String language, List<String> clipIds) async => false;
  @override
  Future<void> stop() async {}
}

/// Kontroller: kamera haqida ovoz BIR marta, banner kamera o'tguncha.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const distance = Distance();
  const start = LatLng(41.1, 69.45);

  Position at(double metersNorth, {double speed = 22}) {
    final p = distance.offset(start, metersNorth, 0);
    return Position(
      latitude: p.latitude,
      longitude: p.longitude,
      timestamp: DateTime(2026, 10, 31),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: speed,
      speedAccuracy: 0,
    );
  }

  Future<(SpeedCameraController, _RecordingTts)> setUpController() async {
    final tts = _RecordingTts();
    final voice = VoiceGuide(engine: tts, clips: _NoClips());
    await voice.init();
    final cam = distance.offset(start, 400, 0);
    final controller = SpeedCameraController(
      voice: voice,
      loadCameras: () async => [
        SpeedCamera(lat: cam.latitude, lng: cam.longitude, maxSpeedKmh: 70),
      ],
    );
    await Future<void>.delayed(Duration.zero);
    return (controller, tts);
  }

  test('ovoz bir marta, banner kamera o\'tguncha', () async {
    final (controller, tts) = await setUpController();

    controller.onPosition(at(0));
    await Future<void>.delayed(Duration.zero);
    expect(tts.spoken, ['Oldinda kamera. Tezlik chegarasi 70.']);
    expect(controller.alert?.overSpeed, isTrue); // 79 km/soat

    controller.onPosition(at(100));
    controller.onPosition(at(200));
    await Future<void>.delayed(Duration.zero);
    expect(tts.spoken, hasLength(1));
    expect(controller.alert, isNotNull);

    controller.onPosition(at(450));
    expect(controller.alert, isNull);
    controller.dispose();
  });

  test('baza yuklanmaguncha GPS e\'tiborsiz — yiqilmaydi', () {
    final controller = SpeedCameraController(
      voice: VoiceGuide(engine: _RecordingTts(), clips: _NoClips()),
      loadCameras: () async => throw StateError('asset yo\'q'),
    );
    controller.onPosition(at(0));
    expect(controller.alert, isNull);
    controller.dispose();
  });
}
