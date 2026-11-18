// Marshrut birinchi urinishda kelmasa (OSRM 404, tarmoq uzildi) navigatsiya
// abadiy marshrutsiz qolmasligi kerak: keyingi GPS ping'larida, lekin
// [TurnByTurnGuidance.routeRetryInterval] dan tez-tez emas, qayta so'raladi.
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/location/voice_clip_player.dart';
import 'package:angren_taxi/core/location/voice_guide.dart';
import 'package:angren_taxi/features/driver/navigation/turn_by_turn_guidance.dart';
import 'package:angren_taxi/shared/models/route_step.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

class _FlakyRouteService implements RouteService {
  /// Shuncha birinchi so'rov `null` qaytaradi.
  _FlakyRouteService({required this.failures});

  int failures;
  int calls = 0;

  @override
  Future<RouteResult?> getRoute(
    LatLng from,
    LatLng to, {
    List<LatLng> waypoints = const [],
  }) async {
    calls++;
    if (failures > 0) {
      failures--;
      return null;
    }
    return RouteResult(
      points: [from, to],
      distanceKm: 1,
      durationMin: 3,
      steps: [
        RouteStep(
          type: ManeuverType.depart,
          modifier: ManeuverModifier.none,
          location: from,
          distanceMeters: 1000,
          durationSeconds: 180,
          name: '',
        ),
        RouteStep(
          type: ManeuverType.arrive,
          modifier: ManeuverModifier.none,
          location: to,
          distanceMeters: 0,
          durationSeconds: 0,
          name: '',
        ),
      ],
    );
  }
}

class _SilentTts implements TtsEngine {
  @override
  Future<List<String>> languages() async => const [];
  @override
  Future<void> setLanguage(String language) async {}
  @override
  Future<void> setSpeechRate(double rate) async {}
  @override
  Future<void> speak(String text) async {}
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

void main() {
  const from = LatLng(41.0100, 70.1400);
  const to = LatLng(41.0200, 70.1500);

  late DateTime now;
  late _FlakyRouteService routes;
  late TurnByTurnGuidance guidance;

  setUp(() {
    now = DateTime(2026, 10, 30, 12);
    routes = _FlakyRouteService(failures: 1);
    guidance = TurnByTurnGuidance(
      routes: routes,
      voice: VoiceGuide(engine: _SilentTts(), clips: _NoClips()),
      clock: () => now,
    );
  });

  tearDown(() => guidance.dispose());

  test('marshrut kelmasa, interval o\'tgach keyingi ping\'da qayta so\'raladi', () async {
    await guidance.start(from, to);
    expect(guidance.hasRoute, isFalse);
    expect(routes.calls, 1);

    // Interval ichida — server bosilmaydi.
    now = now.add(const Duration(seconds: 3));
    guidance.onPosition(from);
    await Future<void>.delayed(Duration.zero);
    expect(routes.calls, 1);

    now = now.add(TurnByTurnGuidance.routeRetryInterval);
    guidance.onPosition(from);
    await Future<void>.delayed(Duration.zero);
    expect(routes.calls, 2);
    expect(guidance.hasRoute, isTrue);
  });

  test('marshrut bor bo\'lsa qayta so\'ralmaydi', () async {
    routes.failures = 0;
    await guidance.start(from, to);
    expect(guidance.hasRoute, isTrue);

    now = now.add(const Duration(minutes: 5));
    guidance.onPosition(from);
    await Future<void>.delayed(Duration.zero);
    expect(routes.calls, 1);
  });
}
