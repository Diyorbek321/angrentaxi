import 'package:angren_taxi/core/location/maneuver_phrases.dart';
import 'package:angren_taxi/core/location/navigation_engine.dart';
import 'package:angren_taxi/core/location/off_route_detector.dart';
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/location/voice_guide.dart';
import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';

/// Pog'onali navigatsiya — marshrut, ko'rsatma, ovoz va qayta qurish BIR joyda.
///
/// Ilgari bularning hammasi `NavigationScreen` ichida edi va faqat yo'lovchini
/// OLISHGA borishda ishlardi; yo'lovchi bilan safarda haydovchi ilovadan
/// tashqariga (Yandex Navigator) chiqishga majbur edi. Endi ikkala ekran ham
/// shu klassni ishlatadi, ya'ni ovoz, chetga chiqish va qayta qurish ikki
/// joyda bir xil ishlaydi.
///
/// Ekran faqat GPS ping'larini [onPosition] ga beradi va [routePoints] /
/// [progress] ni chizadi.
class TurnByTurnGuidance extends ChangeNotifier {
  TurnByTurnGuidance({
    required RouteService routes,
    required VoiceGuide voice,
    DateTime Function()? clock,
  })  : _routes = routes,
        _voice = voice,
        _clock = clock ?? DateTime.now;

  final RouteService _routes;
  final VoiceGuide _voice;
  final DateTime Function() _clock;

  LatLng? _destination;
  List<LatLng> _waypoints = const [];
  NavigationEngine? _engine;
  OffRouteDetector? _offRoute;
  NavigationProgress? _progress;
  List<LatLng> _routePoints = const [];
  bool _rerouting = false;
  bool _disposed = false;

  /// Xaritadagi marshrut chizig'i (yuklanmaguncha bo'sh).
  List<LatLng> get routePoints => _routePoints;

  /// Oxirgi ping'dagi holat — banner uchun. Birinchi ping'gacha `null`.
  NavigationProgress? get progress => _progress;

  /// OSRM manevrlar bergan va dvigatel ishlayapti.
  bool get hasRoute => _engine?.hasRoute ?? false;

  /// Marshrutni yuklaydi va ovozni tayyorlaydi. Har qismi yiqilsa ham ekran
  /// ishlayveradi: marshrut kelmasa banner yo'q, ovoz bo'lmasa banner qoladi.
  Future<void> start(LatLng from, LatLng to, {List<LatLng> waypoints = const []}) async {
    _destination = to;
    _waypoints = waypoints;
    await _load(from);
    // Ovoz marshrutdan KEYIN: birinchi ko'rsatma marshrutsiz aytilmaydi,
    // TTS tillarini so'rash esa sekin.
    await _voice.init();
  }

  /// Yangi marshrut bilan dvigatel va detektor NOLDAN boshlanadi: eski
  /// burilishlar haqida gapirmasin, eski chiziq bilan solishtirmasin.
  Future<void> _load(LatLng from) async {
    final to = _destination;
    if (to == null) return;
    final route = await _routes.getRoute(from, to, waypoints: _waypoints);
    if (_disposed || route == null) return;
    _routePoints = route.points;
    _engine = NavigationEngine(steps: route.steps);
    _offRoute = OffRouteDetector(route.points);
    _notify();
  }

  /// Bekatga shuncha yaqin kelindi — u "o'tilgan".
  static const double waypointReachedMeters = 60;

  /// Hali boriladigan bekatlar (o'tilganlari olib tashlanadi).
  List<LatLng> get remainingWaypoints => _waypoints;

  /// Bitta GPS ping'i.
  void onPosition(LatLng here) {
    final engine = _engine;
    if (engine == null || _disposed) return;

    // Navbatdagi bekatga yetildi — qayta qurishda u endi kiritilmaydi.
    if (_waypoints.isNotEmpty &&
        const Distance().as(LengthUnit.Meter, here, _waypoints.first) <= waypointReachedMeters) {
      _waypoints = _waypoints.sublist(1);
    }

    _progress = engine.update(here);

    // Chetga chiqildi (bir necha ping tasdiqlagan) — yo'l joriy joydan
    // qayta quriladi. Javob kelguncha eski ko'rsatma ekranda qoladi.
    if (_offRoute?.update(here, _clock()) ?? false) {
      _reroute(here);
    }

    // Dvigatel `announcement` ni FAQAT yangi (manevr, bosqich) juftligida
    // qaytaradi — gap takrorlanmaydi.
    final announcement = _progress!.announcement;
    if (announcement != null) {
      _voice.speak(announcement.text, clips: announcement.clips);
    }
    _notify();
  }

  Future<void> _reroute(LatLng here) async {
    if (_rerouting) return;
    _rerouting = true;
    _voice.speak(ManeuverPhrases.rerouting, clips: ManeuverPhrases.reroutingClips);
    try {
      // Faqat HALI O'TILMAGAN bekatlar orqali — aks holda yangi yo'l
      // haydovchini o'tib ketgan bekatga qaytarardi.
      await _load(here);
    } finally {
      _rerouting = false;
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    // Ekran yopilganda gap o'rtasida qolgan ovoz to'xtatiladi.
    _voice.stop();
    super.dispose();
  }
}
